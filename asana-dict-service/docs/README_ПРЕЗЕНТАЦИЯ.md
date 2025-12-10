# Автоматическая генерация PowerPoint презентации

## Быстрый старт

1. **Установите зависимости:**
```bash
pip install -r requirements_presentation.txt
```

2. **Запустите скрипт:**
```bash
cd docs
python generate_presentation.py
```

3. **Готово!** Файл `ПРЕЗЕНТАЦИЯ_Android_приложение.pptx` будет создан в папке `docs`

## Альтернативные способы

### Вариант 1: Онлайн-конвертеры
- [Markdown to PPT](https://www.markdowntopresentation.com/)
- [Pandoc Try](https://pandoc.org/try/) - конвертирует Markdown в PowerPoint

### Вариант 2: Pandoc (если установлен)
```bash
pandoc ПРЕЗЕНТАЦИЯ.md -o ПРЕЗЕНТАЦИЯ.pptx
```

### Вариант 3: Google Slides
1. Откройте [Google Slides](https://slides.google.com)
2. Создайте новую презентацию
3. Скопируйте содержимое из `ПРЕЗЕНТАЦИЯ.md`
4. Вставьте каждый слайд вручную (быстро через Ctrl+V)

### Вариант 4: Онлайн-редакторы
- [Marp](https://marp.app/) - создает презентации из Markdown
- [Slidev](https://sli.dev/) - веб-редактор презентаций

## Что делает скрипт

Скрипт `generate_presentation.py`:
- ✅ Читает файл `ПРЕЗЕНТАЦИЯ.md`
- ✅ Парсит слайды (разделитель `---`)
- ✅ Создает PowerPoint файл с правильным форматированием
- ✅ Добавляет заголовки и контент на каждый слайд

## Настройка

Если нужно изменить дизайн:
1. Откройте созданный `.pptx` файл в PowerPoint
2. Примените нужную тему (Design → Themes)
3. Настройте цвета и шрифты по желанию

