document.getElementById('uploadForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const input = document.getElementById('imageInput');
    if (!input.files.length) return alert('Выберите изображение!');
    const file = input.files[0];
    const loader = document.getElementById('loader');
    const previewBlock = document.getElementById('preview-block');
    const imagePreview = document.getElementById('imagePreview');

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            previewBlock.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        previewBlock.style.display = 'none';
        imagePreview.src = '';
        return;
    }

    loader.style.display = 'block';
    previewBlock.style.opacity = '0.5';

    // Отправка изображения на backend
    const formData = new FormData();
    formData.append('image', file);
    try {
        const response = await fetch('/upload', { method: 'POST', body: formData });
        const uploadData = await response.json();
        if (!response.ok) throw new Error(uploadData.error || 'Ошибка загрузки');

        // Отправка запроса на распознавание
        const detectRes = await fetch('/detect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: uploadData.filename })
        });
        const detectData = await detectRes.json();
        if (!detectRes.ok) throw new Error(detectData.error || 'Ошибка распознавания');

        // Отображение результата
        const resultBlock = document.getElementById('result');
        resultBlock.style.display = '';
        resultBlock.classList.remove('fade-in');
        void resultBlock.offsetWidth; // reflow for restart animation
        resultBlock.classList.add('fade-in');
        // Исходное изображение
        const origUrl = `/data/uploads/${uploadData.filename}`;
        document.getElementById('originalImage').src = origUrl;
        // Размеченное изображение
        const markedUrl = `/data/uploads/${detectData.marked_image}`;
        const markedImage = document.getElementById('markedImage');
        markedImage.src = markedUrl;
        document.getElementById('downloadLink').href = markedUrl;
        document.getElementById('downloadLink').download = detectData.marked_image;
        // Открытие размеченного изображения в полном размере по клику
        markedImage.style.cursor = 'zoom-in';
        markedImage.onclick = function() {
            window.open(markedUrl, '_blank');
        };
        // Список объектов
        const objectsList = document.getElementById('objectsList');
        objectsList.innerHTML = '';
        detectData.objects.forEach(obj => {
            const li = document.createElement('li');
            li.textContent = `${obj.label} (вероятность: ${obj.score})`;
            objectsList.appendChild(li);
        });

        loader.style.display = 'none';
        previewBlock.style.opacity = '1';
    } catch (err) {
        loader.style.display = 'none';
        previewBlock.style.opacity = '1';
        if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
            alert('Не удалось подключиться к серверу. Проверьте, что сервер запущен.');
        } else {
            alert('Ошибка при распознавании: ' + err.message);
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('themeToggle');
    const overlay = document.getElementById('theme-anim-overlay');
    function setTheme(dark) {
        document.body.classList.toggle('dark', dark);
        themeToggle.textContent = dark ? '☀️ Светлая тема' : '🌙 Тёмная тема';
        localStorage.setItem('theme', dark ? 'dark' : 'light');
    }
    function animateThemeChange(dark) {
        // Получаем координаты кнопки
        const rect = themeToggle.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        // Вычисляем максимальный радиус (до углов экрана)
        const maxX = Math.max(cx, window.innerWidth - cx);
        const maxY = Math.max(cy, window.innerHeight - cy);
        const maxR = Math.sqrt(maxX * maxX + maxY * maxY);
        // Цвет для анимации
        const color = dark ? '#181a1b' : '#f6f8fa';
        overlay.style.display = 'block';
        overlay.style.background = `radial-gradient(circle at ${cx}px ${cy}px, ${color} 0, ${color} ${maxR}px, transparent ${maxR+1}px)`;
        overlay.classList.add('active');
        overlay.style.clipPath = `circle(0px at ${cx}px ${cy}px)`;
        overlay.offsetWidth; // force reflow
        overlay.style.transition = 'clip-path 0.7s cubic-bezier(.4,0,.2,1), opacity 0.5s';
        overlay.style.clipPath = `circle(${maxR}px at ${cx}px ${cy}px)`;
        setTimeout(() => {
            setTheme(dark);
            overlay.style.transition = 'opacity 0.5s';
            overlay.classList.remove('active');
            overlay.style.clipPath = '';
            setTimeout(() => {
                overlay.style.background = '';
                overlay.style.display = 'none';
            }, 500);
        }, 700);
    }
    themeToggle.addEventListener('click', () => {
        const dark = !document.body.classList.contains('dark');
        animateThemeChange(dark);
    });
    // Восстановление темы при загрузке
    if (localStorage.getItem('theme') === 'dark') setTheme(true);
});

// Анимация еды на фоне
const foodEmojis = ['🍏', '🍌', '🍕', '🍔', '🥤', '🍰', '🥗', '🍟', '🍦', '🥣'];
const foodWords = ['яблоко', 'банан', 'пицца', 'бургер', 'напиток', 'торт', 'салат', 'картофель фри', 'мороженое', 'суп'];
function spawnFoodBg() {
    const bg = document.getElementById('bg-anim');
    if (!bg) return;
    bg.innerHTML = '';
    for (let i = 0; i < 12; i++) {
        const el = document.createElement('div');
        if (Math.random() > 0.5) {
            el.className = 'bg-food emoji';
            el.textContent = foodEmojis[Math.floor(Math.random() * foodEmojis.length)];
        } else {
            el.className = 'bg-food word';
            el.textContent = foodWords[Math.floor(Math.random() * foodWords.length)];
        }
        el.style.left = Math.random() * 90 + 'vw';
        el.style.top = (100 + Math.random() * 10) + 'vh';
        el.style.fontSize = (2.5 + Math.random() * 4) + 'rem';
        el.style.animationDelay = (Math.random() * 9) + 's';
        bg.appendChild(el);
    }
}
spawnFoodBg();
setInterval(spawnFoodBg, 7000);

// DVD эффект для food-float
function dvdFloatEffect() {
    const container = document.getElementById('classesList');
    const items = Array.from(container.getElementsByClassName('food-float'));
    const boxW = container.offsetWidth;
    const boxH = container.offsetHeight;
    const margin = 10; // px, отступ от краёв
    // Получаем реальные размеры каждого элемента
    const states = items.map((el, i) => {
        const rect = el.getBoundingClientRect();
        const elemW = rect.width;
        const elemH = rect.height;
        // Случайная стартовая позиция (внутри блока, с отступом)
        const x = margin + Math.random() * (boxW - elemW - margin * 2);
        const y = margin + Math.random() * (boxH - elemH - margin * 2);
        // Случайное направление и медленная скорость
        const dx = (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.3);
        const dy = (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.3);
        return { x, y, dx, dy, el, elemW, elemH };
    });
    function animate() {
        for (const s of states) {
            s.x += s.dx;
            s.y += s.dy;
            // Столкновение с краями (с учётом margin)
            if (s.x <= margin) { s.x = margin; s.dx *= -1; }
            if (s.x >= boxW - s.elemW - margin) { s.x = boxW - s.elemW - margin; s.dx *= -1; }
            if (s.y <= margin) { s.y = margin; s.dy *= -1; }
            if (s.y >= boxH - s.elemH - margin) { s.y = boxH - s.elemH - margin; s.dy *= -1; }
            s.el.style.transform = `translate(${s.x}px, ${s.y}px)`;
        }
        requestAnimationFrame(animate);
    }
    animate();
}
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(dvdFloatEffect, 100);
});

// Превью выбранного изображения
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewBlock = document.getElementById('preview-block');

imageInput.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imagePreview.src = e.target.result;
            previewBlock.style.display = 'block';
        };
        reader.readAsDataURL(file);
    } else {
        previewBlock.style.display = 'none';
        imagePreview.src = '';
    }
});
