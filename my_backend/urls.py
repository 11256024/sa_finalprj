from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),

    # 帳號註冊 / 登入
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),

    # 商品相關
    path('products/', views.products, name='products'),
    path('products/add/', views.add_product, name='add_product'),

    # 飲食紀錄相關
    path('diet-records/add/', views.add_diet_record, name='add_diet_record'),
    path('diet-records/history/', views.diet_history, name='diet_history'),

    # 每日紀錄相關
    path('daily-logs/add/', views.add_daily_log, name='add_daily_log'),
    path('daily-logs/', views.daily_logs, name='daily_logs'),

    # 成就相關
    path('achievements/', views.achievements, name='achievements'),

    # 會員資料讀取 / 更新
    # 建議前端主要使用這個
    path('member/profile/<int:member_id>/', views.member_profile, name='member_profile'),

    # 保留這個舊路徑，避免你原本前端有用到 members/id/profile 時壞掉
    path('members/<int:member_id>/profile/', views.member_profile, name='member_profile_alt'),
]