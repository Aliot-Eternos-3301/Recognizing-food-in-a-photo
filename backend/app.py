from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from PIL import Image, ImageDraw
import torch
import os
import numpy as np
import uuid
import logging
from werkzeug.utils import secure_filename

# Пути к модели и классам
MODEL_PATH = os.path.join(os.path.dirname(__file__), '../model/food_model.pt')
CLASSES_PATH = os.path.join(os.path.dirname(__file__), '../model/food_classes.txt')

# Настройка Flask для отдачи фронтенда
FRONTEND_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '../frontend'))
app = Flask(__name__, static_folder=FRONTEND_FOLDER, static_url_path='')
CORS(app)
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), '../data/uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Максимальный размер файла (10 МБ)
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

logging.basicConfig(level=logging.INFO)

def load_model():
    model_path = MODEL_PATH
    if not os.path.exists(model_path):
        raise FileNotFoundError(f'Файл модели не найден: {model_path}')
    try:
        model = torch.hub.load('ultralytics/yolov5', 'custom', path=model_path, force_reload=False)
        return model
    except Exception as e:
        raise RuntimeError(f'Ошибка загрузки модели: {e}')

def load_classes():
    if not os.path.exists(CLASSES_PATH):
        raise FileNotFoundError(f'Файл классов не найден: {CLASSES_PATH}')
    try:
        with open(CLASSES_PATH, 'r', encoding='utf-8') as f:
            return [line.strip() for line in f if line.strip()]
    except Exception as e:
        raise RuntimeError(f'Ошибка загрузки классов: {e}')

model = load_model()
classes = load_classes()

# Отдача index.html по корню
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'Нет файла с ключом image'}), 400
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'Файл не выбран'}), 400
        if not (file.filename.lower().endswith('.jpg') or file.filename.lower().endswith('.jpeg') or file.filename.lower().endswith('.png')):
            return jsonify({'error': 'Поддерживаются только JPG и PNG'}), 400
        # Генерируем уникальное имя файла
        ext = os.path.splitext(file.filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        save_path = os.path.join(UPLOAD_FOLDER, unique_name)
        file.save(save_path)
        # Проверяем, что это действительно изображение
        try:
            with Image.open(save_path) as img:
                img.verify()
        except Exception:
            os.remove(save_path)
            return jsonify({'error': 'Загруженный файл не является изображением или повреждён'}), 400
        return jsonify({'message': 'Файл успешно загружен', 'filename': unique_name}), 200
    except Exception as e:
        logging.exception('Ошибка при загрузке файла:')
        return jsonify({'error': f'Ошибка при загрузке файла: {str(e)}'}), 500

@app.route('/detect', methods=['POST'])
def detect_objects():
    try:
        data = request.get_json()
        filename = data.get('filename')
        if not filename:
            return jsonify({'error': 'Не указано имя файла'}), 400
        image_path = os.path.join(UPLOAD_FOLDER, filename)
        if not os.path.exists(image_path):
            return jsonify({'error': 'Файл не найден'}), 404
        # Инференс YOLOv5
        results = model(image_path)
        detections = results.xyxy[0].cpu().numpy()  # [x1, y1, x2, y2, conf, cls]
        detected = []
        # Открываем изображение для рисования
        image = Image.open(image_path).convert('RGB')
        draw = ImageDraw.Draw(image)
        for det in detections:
            x1, y1, x2, y2, conf, cls_id = det
            label = classes[int(cls_id)] if int(cls_id) < len(classes) else str(int(cls_id))
            detected.append({
                'label': label,
                'score': round(float(conf), 2),
                'box': [int(x1), int(y1), int(x2), int(y2)]
            })
            # Рисуем рамку и подпись
            draw.rectangle([x1, y1, x2, y2], outline='red', width=3)
            draw.text((x1, y1 - 10), f'{label} {conf:.2f}', fill='red')
        # Сохраняем изображение с разметкой
        marked_filename = f'marked_{filename}'
        marked_path = os.path.join(UPLOAD_FOLDER, marked_filename)
        image.save(marked_path)
        return jsonify({'objects': detected, 'marked_image': marked_filename}), 200
    except Exception as e:
        logging.exception('Ошибка при инференсе:')
        return jsonify({'error': f'Ошибка при инференсе: {str(e)}'}), 500

@app.route('/data/uploads/<filename>')
def uploaded_file(filename):
    # Валидация имени файла: только jpg, jpeg, png, marked_*.jpg/png
    allowed = (filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg') or filename.lower().endswith('.png'))
    allowed = allowed and (filename.startswith('marked_') or len(filename.split('.')) == 2)
    if not allowed:
        return jsonify({'error': 'Недопустимое имя файла'}), 400
    safe_name = secure_filename(filename)
    return send_from_directory(UPLOAD_FOLDER, safe_name)

@app.errorhandler(413)
def file_too_large(e):
    return jsonify({'error': 'Файл слишком большой (максимум 10 МБ)'}), 413

if __name__ == '__main__':
    app.run(debug=True)
