import os
from pathlib import Path

# 專案基本路徑
BASE_DIR = Path(__file__).resolve().parent.parent

# 安全金鑰 (開發用)
SECRET_KEY = 'django-insecure-sa-final-project-key'

# 除錯模式 (開發時設為 True)
DEBUG = True

# 允許存取的網域 ('*' 代表允許所有連線，方便組員手機測試)
ALLOWED_HOSTS = ['*']

# 1. 註冊必要的套件
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # 後端 API 必備套件
    'rest_framework',
    'corsheaders',
    
    # 你的 App 資料夾
    'my_backend',
]

# 2. 中間件設定 (CORS 必須放在最上面，確保不被攔截)
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # 必須放在第一行
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'my_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'my_backend.wsgi.application'

# 3. 資料庫設定：連接到你的 Aiven 雲端 MySQL
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'food-app',
        'USER': 'avnadmin',
        'PASSWORD': 'AVNS_jahsbq0dmFPQ7n9P7SX',
        'HOST': 'mysql-28e17ff3-kting1116-197f.f.aivencloud.com',
        'PORT': '27192',
        'OPTIONS': {
            'ssl': {
                'ca': str(BASE_DIR / 'ca.pem'),
            },
        },
    }
}
# 密碼驗證 (開發階段可維持預設)
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]

# 4. 語言與時區設定 (改為繁體中文與台灣時區)
LANGUAGE_CODE = 'zh-hant'
TIME_ZONE = 'Asia/Taipei'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# 5. CORS 設定：允許跨網域連線 (讓組員的 React Native 可以連過來)
CORS_ALLOW_ALL_ORIGINS = True 

# 6. REST Framework 設定 (可選)
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny', # 暫時允許所有人存取 API，方便開發測試
    ]
}