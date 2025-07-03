import torch
import os

# Путь к файлу с классами еды
CLASSES_PATH = os.path.join(os.path.dirname(__file__), 'food_classes.txt')

# Путь к датасету в формате YOLO (data.yaml)
DATA_YAML = os.path.join(os.path.dirname(__file__), 'data.yaml')  # отредактируйте под свой путь

# Параметры обучения
EPOCHS = 50
BATCH_SIZE = 16
IMG_SIZE = 640
WEIGHTS_OUT = os.path.join(os.path.dirname(__file__), 'yolov5s-food.pt')

if __name__ == '__main__':
    # Загрузка модели YOLOv5 через PyTorch Hub
    model = torch.hub.load('ultralytics/yolov5', 'yolov5s', pretrained=True)

    # Обучение
    model.train(
        data=DATA_YAML,         # путь к data.yaml (описание классов и путей к train/val)
        epochs=EPOCHS,
        batch=BATCH_SIZE,
        imgsz=IMG_SIZE,
        project='runs/train',   # папка для логов и результатов
        name='exp-food',
        exist_ok=True
    )

    # Сохранение обученной модели
    # (Ultralytics автоматически сохраняет best.pt и last.pt в runs/train/exp-food/)
    print(f'Обучение завершено. Веса и логи сохранены в runs/train/exp-food/')
