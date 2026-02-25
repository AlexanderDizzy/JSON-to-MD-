// Конвертер JSON файла экспорта Telegram в Markdown с возможностью выбора количества сообщений и выгрузки в ZIP

document.addEventListener('DOMContentLoaded', () => {
    const jsonFileInput = document.getElementById('jsonFile');
    const messageCountSelect = document.getElementById('messageCount');
    const wordCountSection = document.getElementById('wordCountSection');
    const maxWordsInput = document.getElementById('maxWords');
    const wordCountValue = document.getElementById('wordCountValue');
    const convertBtn = document.getElementById('convertBtn');
    const progressSection = document.getElementById('progressSection');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const resultSection = document.getElementById('resultSection');
    const resultText = document.getElementById('resultText');
    const downloadZipBtn = document.getElementById('downloadZipBtn');

    let convertedFiles = [];

    // Обработчик изменения выбора способа ограничения
    messageCountSelect.addEventListener('change', () => {
        if (messageCountSelect.value === 'by_words') {
            wordCountSection.style.display = 'block';
        } else {
            wordCountSection.style.display = 'none';
        }
    });

    // Обработчик изменения значения ползунка
    maxWordsInput.addEventListener('input', () => {
        wordCountValue.textContent = `${maxWordsInput.value} слов`;
    });

    // Функция для конвертации JSON объекта сообщения в Markdown строку
    function messageToMarkdown(messageObj) {
        let md = '';
        
        // Добавляем время сообщения
        if (messageObj.date) {
            const date = new Date(messageObj.date);
            md += `**Дата:** ${date.toLocaleString()}\n\n`;
        }
        
        // Добавляем отправителя
        if (messageObj.from) {
            md += `**От:** ${messageObj.from}`;
            if (messageObj.from_id) {
                md += ` (${messageObj.from_id})`;
            }
            md += '\n';
        }
        
        // Добавляем текст сообщения
        if (messageObj.text) {
            if (typeof messageObj.text === 'string') {
                md += `${messageObj.text}`;
            } else if (Array.isArray(messageObj.text)) {
                // Если текст является массивом (например, с эмодзи или ссылками)
                md += messageObj.text.map(part => {
                    if (typeof part === 'string') {
                        return part;
                    } else if (part.type === 'text_link') {
                        return `[${part.text}](${part.href})`;
                    } else if (part.type === 'mention') {
                        return `[${part.text}](tg://user?id=${part.user_id})`;
                    } else {
                        return part.text || '';
                    }
                }).join('');
            }
        }
        
        md += '\n\n';
        
        // Обработка медиафайлов
        if (messageObj.media_type) {
            md += `**Тип медиа:** ${messageObj.media_type}\n`;
        }
        
        if (messageObj.file) {
            md += `**Файл:** ${messageObj.file}\n`;
        }
        
        // Разделяем сообщения
        md += '---\n\n';
        
        return md;
    }

    // Функция для подсчета слов в строке
    function countWords(str) {
        if (!str) return 0;
        if (typeof str === 'string') {
            return str.trim().split(/\s+/).filter(word => word.length > 0).length;
        } else if (Array.isArray(str)) {
            // Если текст является массивом частей
            return str.reduce((count, part) => {
                if (typeof part === 'string') {
                    return count + countWords(part);
                } else if (part.text) {
                    return count + countWords(part.text);
                }
                return count;
            }, 0);
        }
        return 0;
    }

    // Функция для конвертации JSON данных в Markdown
    function convertJsonToMarkdown(jsonData, limit, maxWordsPerFile = null) {
        const messages = jsonData.messages || [];
        let selectedMessages;
        
        if (limit === 'all') {
            selectedMessages = messages;
        } else if (limit === 'by_words') {
            selectedMessages = messages; // Используем все сообщения, но разобьем по файлам
        } else {
            selectedMessages = messages.slice(0, parseInt(limit));
        }
        
        // Если указан лимит по словам, разбиваем на несколько файлов
        if (limit === 'by_words' && maxWordsPerFile) {
            return convertByWordLimit(jsonData, selectedMessages, maxWordsPerFile);
        }
        
        let markdownContent = `# ${jsonData.name || 'Экспорт Telegram'}\n\n`;
        markdownContent += `Всего сообщений: ${selectedMessages.length}\n\n`;
        
        for (let i = 0; i < selectedMessages.length; i++) {
            markdownContent += messageToMarkdown(selectedMessages[i]);
            
            // Обновляем прогресс
            const percent = Math.round(((i + 1) / selectedMessages.length) * 100);
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `${i + 1}/${selectedMessages.length}`;
        }
        
        return [{
            content: markdownContent,
            filename: `${jsonData.name || 'telegram_export'}.md`,
            totalProcessed: selectedMessages.length
        }];
    }

    // Функция для конвертации с учетом лимита по словам
    function convertByWordLimit(jsonData, messages, maxWordsPerFile) {
        const files = [];
        let currentFileContent = `# ${jsonData.name || 'Экспорт Telegram'}\n\n`;
        let currentWordCount = 0;
        let fileIndex = 1;
        let totalProcessed = 0;

        for (let i = 0; i < messages.length; i++) {
            const messageMarkdown = messageToMarkdown(messages[i]);
            const messageWordCount = countWords(messages[i].text);

            // Если добавление этого сообщения превысит лимит слов
            if (currentWordCount + messageWordCount > maxWordsPerFile && currentWordCount > 0) {
                // Завершаем текущий файл и начинаем новый
                currentFileContent += `\n\nВсего сообщений в файле: ${files.length === 0 ? totalProcessed : totalProcessed - (files.length * (Math.floor(totalProcessed/messages.length * files.length)))}`;
                files.push({
                    content: currentFileContent,
                    filename: `${jsonData.name || 'telegram_export'}_part_${fileIndex}.md`,
                    totalProcessed: totalProcessed
                });

                fileIndex++;
                currentFileContent = `# ${jsonData.name || 'Экспорт Telegram (часть ${fileIndex}')}\n\n`;
                currentWordCount = 0;
            }

            currentFileContent += messageMarkdown;
            currentWordCount += messageWordCount;
            totalProcessed++;

            // Обновляем прогресс
            const percent = Math.round(((i + 1) / messages.length) * 100);
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `${i + 1}/${messages.length}`;
        }

        // Добавляем последний файл, если в нем есть содержимое
        if (currentFileContent.trim() !== `# ${jsonData.name || 'Экспорт Telegram'}\n\n`) {
            currentFileContent += `\n\nВсего сообщений в файле: ${totalProcessed - files.reduce((acc, file) => acc + file.totalProcessed, 0)}`;
            files.push({
                content: currentFileContent,
                filename: `${jsonData.name || 'telegram_export'}_part_${fileIndex}.md`,
                totalProcessed: totalProcessed - files.reduce((acc, f) => acc + f.totalProcessed, 0)
            });
        }

        return files;
    }

    // Функция для создания ZIP архива
    async function createZip(files) {
        // Проверяем, загружен ли JSZip
        if (typeof JSZip !== 'undefined') {
            // JSZip уже загружен
            const zip = new JSZip();
            
            files.forEach(file => {
                zip.file(file.filename, file.content);
            });
            
            return await zip.generateAsync({ type: 'blob' });
        } else {
            // Загружаем JSZip из CDN
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            document.head.appendChild(script);

            return new Promise((resolve, reject) => {
                script.onload = async () => {
                    const zip = new JSZip();
                    
                    files.forEach(file => {
                        zip.file(file.filename, file.content);
                    });
                    
                    try {
                        const blob = await zip.generateAsync({ type: 'blob' });
                        resolve(blob);
                    } catch (error) {
                        reject(error);
                    }
                };
                
                script.onerror = () => {
                    reject(new Error('Не удалось загрузить JSZip'));
                };
            });
        }
    }

    // Обработчик кнопки конвертации
    convertBtn.addEventListener('click', async () => {
        const file = jsonFileInput.files[0];
        if (!file) {
            alert('Пожалуйста, выберите JSON файл');
            return;
        }
        
        const messageLimit = messageCountSelect.value;
        const maxWords = parseInt(maxWordsInput.value);
        
        try {
            // Показываем прогресс
            progressSection.style.display = 'block';
            resultSection.style.display = 'none';
            
            // Читаем файл
            const jsonString = await readFileAsText(file);
            const jsonData = JSON.parse(jsonString);
            
            // Конвертируем в Markdown
            let results;
            if (messageLimit === 'by_words') {
                results = convertJsonToMarkdown(jsonData, messageLimit, maxWords);
            } else {
                results = convertJsonToMarkdown(jsonData, messageLimit);
            }
            
            // Сохраняем результат
            convertedFiles = Array.isArray(results) ? results : [results];
            
            // Обновляем UI
            resultText.textContent = `Конвертация завершена! Обработано ${convertedFiles.reduce((sum, file) => sum + file.totalProcessed, 0)} сообщений. Создано ${convertedFiles.length} файлов.`;
            progressSection.style.display = 'none';
            resultSection.style.display = 'block';
            
        } catch (error) {
            console.error('Ошибка при обработке:', error);
            alert(`Ошибка при обработке файла: ${error.message}`);
            progressSection.style.display = 'none';
        }
    });

    // Обработчик кнопки скачивания ZIP
    downloadZipBtn.addEventListener('click', async () => {
        if (convertedFiles.length === 0) {
            alert('Нет данных для экспорта');
            return;
        }
        
        try {
            const zipBlob = await createZip(convertedFiles);
            
            // Создаем ссылку для скачивания
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'telegram_export.zip';
            document.body.appendChild(a);
            a.click();
            
            // Удаляем ссылку
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
            
        } catch (error) {
            console.error('Ошибка при создании ZIP:', error);
            alert(`Ошибка при создании ZIP архива: ${error.message}`);
        }
    });

    // Вспомогательная функция для чтения файла как текста
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }
});