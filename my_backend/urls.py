from django.urls import path
from . import views

urlpatterns = [
    # 網址會長這樣：http://127.0.0.1:8000/register/
    path('register/', views.register_member, name='register'),
]