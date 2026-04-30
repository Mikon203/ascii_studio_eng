const upload = document.getElementById('upload');
const modeSelect = document.getElementById('mode');
const resInput = document.getElementById('resolution');
const resVal = document.getElementById('res-val');
const brightInput = document.getElementById('brightness');
const brightVal = document.getElementById('bright-val');
const useColor = document.getElementById('use-color');
const bgColorInput = document.getElementById('bg-color');
const canvas = document.getElementById('canvas-preview');
const ctx = canvas.getContext('2d');
const outputHtml = document.getElementById('output-html');
const downloadBtn = document.getElementById('download-btn');

const asciiChars = "@#S%?*+;:,. ";
let originalImage = null;
let currentRatio = 'original';

// Выбор формата
document.querySelectorAll('.ratio-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentRatio = this.dataset.ratio;
        render();
    });
});

// Загрузка фото
upload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => { originalImage = img; render(); };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

// Слушатели изменений
[resInput, brightInput, modeSelect, useColor, bgColorInput].forEach(el => {
    el.addEventListener('input', () => {
        resVal.innerText = resInput.value;
        brightVal.innerText = brightInput.value;
        render();
    });
});

function render() {
    if (!originalImage) return;

    const widthSymbols = parseInt(resInput.value); // Количество символов по горизонтали
    const bShift = (parseInt(brightInput.value) - 50) * 2;
    const mode = modeSelect.value;

    // 1. Считаем пропорции для ХОЛСТА (Canvas)
    let targetRatioVal = originalImage.width / originalImage.height;
    if (currentRatio === '1:1') targetRatioVal = 1;
    if (currentRatio === '16:9') targetRatioVal = 16/9;
    if (currentRatio === '4:3') targetRatioVal = 4/3;

    // Физический размер холста в пикселях (всегда кратен 10 для удобства)
    canvas.width = widthSymbols * 10;
    canvas.height = Math.floor(canvas.width / targetRatioVal);

    // 2. Считаем сетку СИМВОЛОВ
    // Если ASCII — нам нужно меньше строк, т.к. буквы высокие. 
    // Если ПИКСЕЛИ — сетка должна быть ровной.
    const symbolsX = widthSymbols;
    const symbolsY = (mode === 'pixels') 
        ? Math.floor(canvas.height / 10) 
        : Math.floor((canvas.height / 10) * 0.7); // 0.7 — золотая середина для шрифтов

    // Очистка и фон
    ctx.fillStyle = bgColorInput.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Временный холст для подготовки данных
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = symbolsX;
    tempCanvas.height = symbolsY;

    // Растягиваем изображение на всю сетку символов
    tempCtx.drawImage(originalImage, 0, 0, symbolsX, symbolsY);
    
    const pixels = tempCtx.getImageData(0, 0, symbolsX, symbolsY).data;
    let htmlBuffer = "";
    
    // Шаг отрисовки на холсте (чтобы всё влезло ровно)
    const stepX = canvas.width / symbolsX;
    const stepY = canvas.height / symbolsY;

    ctx.textBaseline = "top";
    if (mode !== 'pixels') {
        // Подбираем размер шрифта под шаг сетки
        ctx.font = `${Math.ceil(stepY * 1.2)}px monospace`;
    }

    for (let y = 0; y < symbolsY; y++) {
        let htmlRow = "";
        for (let x = 0; x < symbolsX; x++) {
            const i = (y * symbolsX + x) * 4;
            const r = pixels[i], g = pixels[i+1], b = pixels[i+2], a = pixels[i+3];
            const gray = (0.2126 * r + 0.7152 * g + 0.0722 * b);

            if (a < 128 || gray > 252) {
                htmlRow += "&nbsp;";
                continue;
            }

            let char;
            if (mode === 'pixels') {
                char = "█";
            } else {
                let adjGray = Math.max(0, Math.min(255, gray - bShift));
                const charIdx = Math.floor((adjGray / 255) * (asciiChars.length - 1));
                char = asciiChars[charIdx];
            }

            if (useColor.checked) {
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                htmlRow += `<span style="color:rgb(${r},${g},${b})">${char}</span>`;
            } else {
                ctx.fillStyle = "#fff";
                htmlRow += char;
            }

            if (mode === 'pixels') {
                // Рисуем блок точно по размеру ячейки сетки
                ctx.fillRect(x * stepX, y * stepY, Math.ceil(stepX), Math.ceil(stepY));
            } else {
                ctx.fillText(char, x * stepX, y * stepY);
            }
        }
        htmlBuffer += htmlRow + "\n";
    }
    outputHtml.innerHTML = htmlBuffer;
}

downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'art-studio-result.png';
    link.href = canvas.toDataURL();
    link.click();
});