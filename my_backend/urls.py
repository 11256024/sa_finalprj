from django.contrib import admin
from django.urls import path
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),

    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),

    path('products/', views.products, name='products'),
    path('products/add/', views.add_product, name='add_product'),

    path('diet-records/add/', views.add_diet_record, name='add_diet_record'),
    path('diet-records/history/', views.diet_history, name='diet_history'),

    path('daily-logs/add/', views.add_daily_log, name='add_daily_log'),
    path('daily-logs/', views.daily_logs, name='daily_logs'),

    path('achievements/', views.achievements, name='achievements'),
    path('members/<int:member_id>/profile/', views.member_profile, name='member_profile'),
]

