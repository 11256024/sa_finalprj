from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

from .models import Members, Products, DietRecords, DailyLogs, Achievements, MemberAchievements
from .serializers import (
    MemberSerializer,
    ProductSerializer,
    DietRecordSerializer,
    DailyLogSerializer,
    AchievementSerializer,
    MemberAchievementSerializer,
)
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.hashers import make_password, check_password

from .models import Members


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

    member = Members.objects.create(
        username=username,
        password=make_password(password),
        role='user'
    )

    return Response({
        "success": True,
        "message": "註冊成功",
        "member": {
            "id": member.id,
            "username": member.username,
            "role": member.role,
        }
    }, status=status.HTTP_201_CREATED)


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

@api_view(['POST'])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')

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
        "member": {
            "id": member.id,
            "username": member.username,
            "role": member.role,
        }
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

    # 取得會員資料
    if request.method == 'GET':
        return Response({
            "success": True,
            "member": {
                "id": member.id,
                "username": member.username,
                "role": member.role,
                "gender": member.gender,
                "birthday": member.birthday,
                "height": member.height,
                "initial_weight": member.initial_weight,
                "activity_level": member.activity_level,
            }
        })

    # 更新會員資料
    if request.method == 'PUT':
        data = request.data

        if data.get("username") is not None:
            member.username = data.get("username")

        if data.get("gender") is not None:
            member.gender = data.get("gender")

        if data.get("birthday") is not None:
            member.birthday = data.get("birthday")

        if data.get("height") is not None:
            member.height = data.get("height")

        if data.get("initial_weight") is not None:
            member.initial_weight = data.get("initial_weight")

        if data.get("activity_level") is not None:
            member.activity_level = data.get("activity_level")

        # 密碼有填才更新，空白就不要改
        if data.get("password"):
            member.password = make_password(data.get("password"))

        member.save()

        return Response({
            "success": True,
            "message": "會員資料更新成功",
            "member": {
                "id": member.id,
                "username": member.username,
                "role": member.role,
                "gender": member.gender,
                "birthday": member.birthday,
                "height": member.height,
                "initial_weight": member.initial_weight,
                "activity_level": member.activity_level,
            }
        })
    