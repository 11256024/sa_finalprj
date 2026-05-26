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



def get_admin_member_or_response(request):
    """從 request 裡讀取目前登入的管理者 id，並確認 members.role == 'admin'。"""
    member_id = request.data.get('member') or request.data.get('admin') or request.data.get('admin_id')

    if not member_id:
        return None, Response({
            "success": False,
            "message": "缺少管理者會員 ID"
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        admin_member = Members.objects.get(id=member_id)
    except Members.DoesNotExist:
        return None, Response({
            "success": False,
            "message": "找不到管理者會員"
        }, status=status.HTTP_404_NOT_FOUND)

    if admin_member.role != 'admin':
        return None, Response({
            "success": False,
            "message": "只有管理者可以執行此操作"
        }, status=status.HTTP_403_FORBIDDEN)

    return admin_member, None

@api_view(['GET'])
def products(request):
    """一般商品查詢：只回傳已通過審核/正式上架的商品。"""
    data = Products.objects.filter(status='approved').order_by('name')
    serializer = ProductSerializer(data, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def pending_products(request):
    """管理者審核頁：只列出待審核商品。"""
    data = Products.objects.filter(status='pending').order_by('-created_at')
    serializer = ProductSerializer(data, many=True)
    return Response(serializer.data)


@api_view(['GET'])
def rejected_products(request):
    """管理者審核紀錄：列出未通過商品。"""
    data = Products.objects.filter(status='rejected').order_by('-created_at')
    serializer = ProductSerializer(data, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def add_product(request):
    """
    新增商品：
    - 一般使用者新增：status = pending，等管理者審核
    - 管理者新增：status = approved，直接上架
    前端可傳 member / creator / creator_id 任一種作為建立者會員 id。
    """
    data = request.data.copy()

    member_id = data.get('member') or data.get('creator') or data.get('creator_id')
    member = None

    if member_id:
        try:
            member = Members.objects.get(id=member_id)
            data['creator'] = member.id
        except Members.DoesNotExist:
            return Response({
                "success": False,
                "message": "找不到會員"
            }, status=status.HTTP_404_NOT_FOUND)

    if member and member.role == 'admin':
        data['status'] = 'approved'
    else:
        data['status'] = 'pending'

    serializer = ProductSerializer(data=data)

    if serializer.is_valid():
        product = serializer.save()
        return Response({
            "success": True,
            "message": "商品新增成功，等待管理者審核" if product.status == 'pending' else "商品新增成功，已直接上架",
            "product": ProductSerializer(product).data
        }, status=status.HTTP_201_CREATED)

    return Response({
        "success": False,
        "message": "商品新增失敗",
        "errors": serializer.errors
    }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
def approve_product(request, product_id):
    admin_member, error_response = get_admin_member_or_response(request)
    if error_response:
        return error_response

    try:
        product = Products.objects.get(id=product_id)
    except Products.DoesNotExist:
        return Response({
            "success": False,
            "message": "找不到商品"
        }, status=status.HTTP_404_NOT_FOUND)

    product.status = 'approved'
    product.save()

    return Response({
        "success": True,
        "message": "商品已通過審核並上架",
        "reviewer": member_to_dict(admin_member),
        "product": ProductSerializer(product).data
    })


@api_view(['POST'])
def reject_product(request, product_id):
    admin_member, error_response = get_admin_member_or_response(request)
    if error_response:
        return error_response

    try:
        product = Products.objects.get(id=product_id)
    except Products.DoesNotExist:
        return Response({
            "success": False,
            "message": "找不到商品"
        }, status=status.HTTP_404_NOT_FOUND)

    product.status = 'rejected'
    product.save()

    return Response({
        "success": True,
        "message": "商品已拒絕",
        "reviewer": member_to_dict(admin_member),
        "product": ProductSerializer(product).data
    })


@api_view(['DELETE', 'POST'])
def delete_product(request, product_id):
    admin_member, error_response = get_admin_member_or_response(request)
    if error_response:
        return error_response

    try:
        product = Products.objects.get(id=product_id)
    except Products.DoesNotExist:
        return Response({
            "success": False,
            "message": "找不到商品"
        }, status=status.HTTP_404_NOT_FOUND)

    product.delete()

    return Response({
        "success": True,
        "message": "商品已刪除",
        "reviewer": member_to_dict(admin_member),
    })


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
