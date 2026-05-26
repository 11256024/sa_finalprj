from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.hashers import make_password, check_password

from .models import (
    Members,
    Products,
    DietRecords,
    DailyLogs,
    Achievements,
    MemberAchievements,
)
from .serializers import (
    MemberSerializer,
    ProductSerializer,
    DietRecordSerializer,
    DailyLogSerializer,
    AchievementSerializer,
    MemberAchievementSerializer,
)


def member_to_dict(member):
    """統一回傳給前端的會員資料格式。"""
    return {
        "id": member.id,
        "username": member.username,
        "role": member.role,
        "name": member.name,
        "avatar": member.avatar,
        "gender": member.gender,
        "birthday": member.birthday.isoformat() if member.birthday else None,
        "height": member.height,
        "initial_weight": member.initial_weight,
        "created_at": member.created_at.isoformat() if member.created_at else None,
    }


def clean_empty(value):
    """前端如果傳空字串，資料庫存成 NULL。"""
    if value == "":
        return None
    return value


@api_view(['POST'])
def register(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({
            "success": False,
            "message": "請輸入帳號和密碼"
        }, status=status.HTTP_400_BAD_REQUEST)

    if Members.objects.filter(username=username).exists():
        return Response({
            "success": False,
            "message": "帳號已存在"
        }, status=status.HTTP_400_BAD_REQUEST)

    # 一般前端註冊一律先建立為 user。
    # 管理者請到資料庫或 Django shell 將 role 改成 admin，比較安全。
    member = Members.objects.create(
        username=username,
        password=make_password(password),
        role='user'
    )

    return Response({
        "success": True,
        "message": "註冊成功",
        "member": member_to_dict(member),
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({
            "success": False,
            "message": "請輸入帳號和密碼"
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        member = Members.objects.get(username=username)
    except Members.DoesNotExist:
        return Response({
            "success": False,
            "message": "帳號不存在"
        }, status=status.HTTP_400_BAD_REQUEST)

    if not check_password(password, member.password):
        return Response({
            "success": False,
            "message": "密碼錯誤"
        }, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        "success": True,
        "message": "登入成功",
        "member": member_to_dict(member),
    })


@api_view(['GET', 'PUT'])
def member_profile(request, member_id):
    try:
        member = Members.objects.get(id=member_id)
    except Members.DoesNotExist:
        return Response({
            "success": False,
            "message": "找不到會員"
        }, status=status.HTTP_404_NOT_FOUND)

    def safe_birthday(value):
        if not value:
            return None

        # 如果已經是字串，例如 "2023-03-10"，直接回傳
        if isinstance(value, str):
            return value

        # 如果是 date / datetime，才使用 strftime
        if hasattr(value, "strftime"):
            return value.strftime("%Y-%m-%d")

        return str(value)

    def member_to_dict(member):
        return {
            "id": member.id,
            "username": member.username,
            "role": member.role,
            "name": member.name,
            "avatar": member.avatar,
            "gender": member.gender,
            "birthday": safe_birthday(member.birthday),
            "height": member.height,
            "initial_weight": member.initial_weight,
        }

    if request.method == 'GET':
        return Response({
            "success": True,
            "member": member_to_dict(member)
        })

    if request.method == 'PUT':
        data = request.data

        # 只有前端有傳欄位時才更新，避免沒傳的欄位被清空
        if "name" in data:
            member.name = data.get("name") or None

        if "avatar" in data:
            member.avatar = data.get("avatar") or None

        if "gender" in data:
            member.gender = data.get("gender")

        if "birthday" in data:
            member.birthday = data.get("birthday") or None

        if "height" in data:
            member.height = data.get("height") or None

        if "initial_weight" in data:
            member.initial_weight = data.get("initial_weight") or None

        member.save()

        # 重新從資料庫抓一次，避免 birthday 還是字串造成錯誤
        member.refresh_from_db()

        return Response({
            "success": True,
            "message": "會員資料更新成功",
            "member": member_to_dict(member)
        }, status=status.HTTP_200_OK)

@api_view(['GET'])
def products(request):
    data = Products.objects.all()
    serializer = ProductSerializer(data, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def add_product(request):
    serializer = ProductSerializer(data=request.data)

    if serializer.is_valid():
        product = serializer.save()
        return Response({
            "message": "商品新增成功",
            "product": ProductSerializer(product).data
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def add_diet_record(request):
    serializer = DietRecordSerializer(data=request.data)

    if serializer.is_valid():
        record = serializer.save()
        return Response({
            "message": "飲食紀錄新增成功",
            "record": DietRecordSerializer(record).data
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def diet_history(request):
    member_id = request.GET.get('member_id')

    records = DietRecords.objects.all().order_by('-log_date')

    if member_id:
        records = records.filter(member_id=member_id)

    serializer = DietRecordSerializer(records, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def add_daily_log(request):
    serializer = DailyLogSerializer(data=request.data)

    if serializer.is_valid():
        log = serializer.save()
        return Response({
            "message": "每日紀錄新增成功",
            "daily_log": DailyLogSerializer(log).data
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def daily_logs(request):
    member_id = request.GET.get('member_id')

    logs = DailyLogs.objects.all().order_by('-date')

    if member_id:
        logs = logs.filter(member_id=member_id)

    serializer = DailyLogSerializer(logs, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def achievements(request):
    data = Achievements.objects.all()
    serializer = AchievementSerializer(data, many=True)
    return Response(serializer.data)
