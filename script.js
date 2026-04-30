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

// BG removal controls
const bgRemoveEnabled = document.getElementById('bg-remove-enabled');
const bgRemoveColor = document.getElementById('bg-remove-color');
const bgThreshold = document.getElementById('bg-threshold');
const bgThresholdVal = document.getElementById('bg-threshold-val');
const bgFeather = document.getElementById('bg-feather');
const bgFeatherVal = document.getElementById('bg-feather-val');
const bgRemovalSection = document.querySelector('.bg-removal-section');

bgRemoveEnabled.addEventListener('change', () => {
    bgRemovalSection.classList.toggle('active', bgRemoveEnabled.checked);
    render();
});

[bgRemoveColor, bgThreshold, bgFeather].forEach(el => {
    el.addEventListener('input', () => {
        bgThresholdVal.textContent = bgThreshold.value;
        bgFeatherVal.textContent = bgFeather.value;
        render();
    });
});

// Позволяем пипеткой выбрать цвет фона с загруженного изображения
document.getElementById('bg-eyedrop-hint').addEventListener('click', () => {
    if (!originalImage) return;
    // Берём цвет из угла изображения (верхний левый — обычно фон)
    const tempC = document.createElement('canvas');
    tempC.width = originalImage.width;
    tempC.height = originalImage.height;
    const tempCx = tempC.getContext('2d');
    tempCx.drawImage(originalImage, 0, 0);
    const corners = [
        tempCx.getImageData(0, 0, 1, 1).data,
        tempCx.getImageData(originalImage.width - 1, 0, 1, 1).data,
        tempCx.getImageData(0, originalImage.height - 1, 1, 1).data,
        tempCx.getImageData(originalImage.width - 1, originalImage.height - 1, 1, 1).data,
    ];
    // Среднее по углам
    const avg = corners.reduce((acc, c) => [acc[0]+c[0], acc[1]+c[1], acc[2]+c[2]], [0,0,0])
        .map(v => Math.round(v / corners.length));
    bgRemoveColor.value = '#' + avg.map(v => v.toString(16).padStart(2, '0')).join('');
    render();
});

// Вычисляем "расстояние" между двумя цветами в RGB
function colorDistance(r1, g1, b1, r2, g2, b2) {
    // Взвешенное евклидово расстояние — более точное восприятие
    const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt(0.3 * dr*dr + 0.59 * dg*dg + 0.11 * db*db);
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return [r, g, b];
}

// Применяем удаление фона к пикселям изображения
function applyBgRemoval(imageData, width, height) {
    const data = new Uint8ClampedArray(imageData.data);
    const threshold = parseInt(bgThreshold.value);
    const feather = parseInt(bgFeather.value);
    const [br, bg, bb] = hexToRgb(bgRemoveColor.value);

    // Шаг 1: вычисляем маску (0 = фон, 255 = объект)
    const mask = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
        const dist = colorDistance(r, g, b, br, bg, bb);
        // Плавный переход вместо резкой границы
        if (dist < threshold) {
            mask[i] = 0;
        } else if (dist < threshold + feather) {
            mask[i] = (dist - threshold) / feather; // 0..1
        } else {
            mask[i] = 1;
        }
    }

    // Шаг 2: применяем маску к альфа-каналу
    for (let i = 0; i < width * height; i++) {
        data[i*4 + 3] = Math.round(mask[i] * data[i*4 + 3]);
    }

    return new ImageData(data, width, height);
}


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
    
    let imgData = tempCtx.getImageData(0, 0, symbolsX, symbolsY);
    if (bgRemoveEnabled.checked) {
        imgData = applyBgRemoval(imgData, symbolsX, symbolsY);
    }
    const pixels = imgData.data;
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