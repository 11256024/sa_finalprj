from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.hashers import make_password, check_password
from datetime import datetime, date

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


def validate_member_data(data):
    """驗證會員身體資料的合理性，根據年齡動態驗證身高和體重。
    
    Returns:
        tuple: (is_valid: bool, error_message: str or None)
    """
    errors = []
    age = None
    
    # 先計算或獲取年齡
    if "birthday" in data and data["birthday"]:
        try:
            birthday = datetime.fromisoformat(str(data["birthday"])).date()
            today = date.today()
            age = today.year - birthday.year - ((today.month, today.day) < (birthday.month, birthday.day))
        except (ValueError, TypeError):
            errors.append("生日格式錯誤")
    
    if "age" in data and data["age"]:
        try:
            age = int(data["age"])
        except (ValueError, TypeError):
            errors.append("年齡格式錯誤")
    
    # 驗證年齡範圍 (1-120 歲)
    if age is not None:
        if age < 1:
            errors.append("年齡不能少於 1 歲")
        elif age > 120:
            errors.append("年齡不能超過 120 歲")
    
    # 根據年齡定義身高和體重範圍
    def get_height_weight_ranges(age_val):
        """返回 (min_height, max_height, min_weight, max_weight) 根據年齡"""
        if age_val is None:
            # 無年齡時使用寬鬆範圍
            return (50, 250, 2, 200)
        elif age_val < 1:
            return (45, 80, 2, 15)
        elif age_val < 2:
            return (70, 90, 8, 18)
        elif age_val < 4:
            return (80, 105, 10, 22)
        elif age_val < 7:
            return (95, 125, 13, 35)
        elif age_val < 13:
            return (110, 165, 20, 65)
        else:  # 13+ 歲
            return (140, 210, 30, 200)
    
    min_h, max_h, min_w, max_w = get_height_weight_ranges(age)
    
    # 驗證身高
    if "height" in data and data["height"]:
        try:
            height = float(data["height"])
            if height < min_h:
                errors.append(f"身高不能少於 {min_h} cm (依據年齡)")
            elif height > max_h:
                errors.append(f"身高不能超過 {max_h} cm (依據年齡)")
        except (ValueError, TypeError):
            errors.append("身高格式錯誤")
    
    # 驗證體重
    if "initial_weight" in data and data["initial_weight"]:
        try:
            weight = float(data["initial_weight"])
            if weight < min_w:
                errors.append(f"體重不能少於 {min_w} kg (依據年齡)")
            elif weight > max_w:
                errors.append(f"體重不能超過 {max_w} kg (依據年齡)")
        except (ValueError, TypeError):
            errors.append("體重格式錯誤")
    
    if errors:
        return False, "\n".join(errors)
    
    return True, None


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

        # 先驗證身體數據
        is_valid, error_msg = validate_member_data(data)
        if not is_valid:
            return Response({
                "success": False,
                "message": error_msg
            }, status=status.HTTP_400_BAD_REQUEST)

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
    """一般商品查詢：只回傳已通過審核/正式上架的商品。
    支援 ?creator_id=X 過濾出某位會員提交的商品。
    """
    qs = Products.objects.filter(status='approved')

    creator_id = request.GET.get('creator_id')
    if creator_id and str(creator_id).isdigit():
        qs = qs.filter(creator_id=int(creator_id))

    serializer = ProductSerializer(qs.order_by('name'), many=True)
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


# 系統內建的成就清單；id 用前端硬編碼那組以便對齊
# 條件 (category, threshold) 由前端計算進度，後端只負責記錄解鎖事件
SEED_ACHIEVEMENTS = [
    ('l1',  '初來乍到 (連續紀錄體重 1 天)',  'login',   1),
    ('l3',  '養成習慣 (連續紀錄體重 3 天)',  'login',   3),
    ('l7',  '持之以恒 (連續紀錄體重 7 天)',  'login',   7),
    ('l30', '自律達人 (連續紀錄體重 30 天)', 'login',  30),
    ('w05', '輕盈起步 (體重減少 0.5 KG)',          'weight',  0.5),
    ('w1',  '看見成效 (體重減少 1 KG)',            'weight',  1),
    ('w3',  '焕然一新 (體重減少 3 KG)',            'weight',  3),
    ('w5',  '完美蜕變 (體重減少 5 KG)',            'weight',  5),
    ('p1',  '誠信商家 (審核上架商品 1 件)',  'product', 1),
    ('p3',  '精選賣家 (審核上架商品 3 件)',  'product', 3),
    ('p5',  '琰瑯滿目 (審核上架商品 5 件)',  'product', 5),    ('p10', '超級商城 (審核上架商品 10 件)', 'product', 10),]


def _ensure_seed_achievements():
    """第一次查詢時自動把預設 11 條成就寫進 DB。如果標題變了也會跟著更新。"""
    for code, title, _cat, _th in SEED_ACHIEVEMENTS:
        Achievements.objects.update_or_create(
            description=code,                # 用 description 欄裝 code (l1/w1/p3...)作為穩定識別碼
            defaults={'title': title},
        )


@api_view(['GET'])
def achievements(request):
    """
    GET /achievements/                 -> 所有成就定義
    GET /achievements/?member_id=1     -> 加上該會員的 earned_at（未解鎖 = null）
    """
    _ensure_seed_achievements()

    member_id = request.GET.get('member_id')
    achievements_qs = Achievements.objects.all().order_by('id')

    earned_map = {}
    if member_id and member_id.isdigit():
        for ma in MemberAchievements.objects.filter(member_id=int(member_id)).select_related('achievement'):
            earned_map[ma.achievement_id] = ma.earned_at.isoformat()

    result = []
    for ach in achievements_qs:
        result.append({
            'id': ach.id,
            'code': ach.description,    # 前端用這個對齊本機 UI id
            'title': ach.title,
            'earned_at': earned_map.get(ach.id),
        })
    return Response(result)


@api_view(['POST'])
def unlock_achievement(request):
    """
    POST /achievements/unlock/
    body: { "member_id": 1, "codes": ["l1", "w05"] }
    只寫入未解鎖的；已解鎖過的保留原 earned_at。
    回傳這次「新」解鎖的 codes，讓前端能跳「恭喜達成」提示。
    """
    _ensure_seed_achievements()
    member_id = request.data.get('member_id')
    codes = request.data.get('codes') or []

    if not member_id or not str(member_id).isdigit():
        return Response({'detail': 'member_id 無效'}, status=status.HTTP_400_BAD_REQUEST)
    if not isinstance(codes, list):
        return Response({'detail': 'codes 需為陣列'}, status=status.HTTP_400_BAD_REQUEST)

    member_id = int(member_id)
    if not Members.objects.filter(id=member_id).exists():
        return Response({'detail': '會員不存在'}, status=status.HTTP_404_NOT_FOUND)

    achievements_by_code = {a.description: a for a in Achievements.objects.filter(description__in=codes)}
    already = set(
        MemberAchievements.objects
        .filter(member_id=member_id, achievement__description__in=codes)
        .values_list('achievement__description', flat=True)
    )

    newly_unlocked = []
    for code in codes:
        if code in already:
            continue
        ach = achievements_by_code.get(code)
        if not ach:
            continue
        MemberAchievements.objects.create(member_id=member_id, achievement=ach)
        newly_unlocked.append(code)

    return Response({'newly_unlocked': newly_unlocked})


# 中文 -> 英文 meal_type 對照（前端送繁中也接受）
_MEAL_ZH_TO_EN = {
    'breakfast': 'breakfast', 'lunch': 'lunch', 'dinner': 'dinner',
    '早餐': 'breakfast', '午餐': 'lunch', '晚餐': 'dinner',
}
_MEAL_EN_TO_ZH = {'breakfast': '早餐', 'lunch': '午餐', 'dinner': '晚餐'}


def _parse_float(value):
    try:
        if value is None or value == '':
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


@api_view(['POST'])
def save_daily(request):
    """
    一次儲存某會員某天的「體重 + 三餐」，後端會：
    - upsert DailyLogs（同 member + date 只一筆）
    - 刪掉該天舊的 DietRecords，再依前端送來的內容重建
    request.data:
    {
      "member_id": 1,
      "date": "2026-05-30",
      "weight": "65.2"  (可空字串代表清除),
      "meals": {
        "breakfast": [{"name": "御飯糰/60克", "calories": 200}, ...],
        "lunch": [...],
        "dinner": [...]
      }
    }
    """
    member_id = request.data.get('member_id') or request.data.get('member')
    date_str = request.data.get('date')
    weight_raw = request.data.get('weight')
    meals = request.data.get('meals') or {}

    if not member_id or not date_str:
        return Response({
            "success": False,
            "message": "缺少 member_id 或 date"
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        member = Members.objects.get(id=member_id)
    except Members.DoesNotExist:
        return Response({
            "success": False,
            "message": "找不到會員"
        }, status=status.HTTP_404_NOT_FOUND)

    weight_value = _parse_float(weight_raw)

    # 1) Upsert DailyLogs
    daily_log, _ = DailyLogs.objects.get_or_create(
        member=member,
        date=date_str,
    )
    daily_log.weight = weight_value
    daily_log.save()  # save() 內部會自動算 BMI

    # 注意：每日紀錄的體重不再回寫 member.initial_weight，
    # 會員中心的體重由會員中心自己維護，與每日紀錄分離。

    # 2) 重建當天 DietRecords
    DietRecords.objects.filter(member=member, log_date=date_str).delete()

    created_records = []
    for raw_meal_type, items in meals.items():
        meal_type = _MEAL_ZH_TO_EN.get(raw_meal_type)
        if not meal_type or not isinstance(items, list):
            continue

        for item in items:
            if not isinstance(item, dict):
                continue
            name = (item.get('name') or '').strip()
            if not name:
                continue
            calories = _parse_float(item.get('calories')) or 0
            serving_size = _parse_float(item.get('serving_size')) or 1

            record = DietRecords.objects.create(
                member=member,
                meal_type=meal_type,
                food_name=name,
                unit=item.get('unit') or None,
                calories=calories,
                serving_size=serving_size,
                log_date=date_str,
            )
            created_records.append(record)

    return Response({
        "success": True,
        "message": "每日紀錄同步成功",
        "daily_log": DailyLogSerializer(daily_log).data,
        "diet_records": DietRecordSerializer(created_records, many=True).data,
    })


@api_view(['GET'])
def daily_summary(request):
    """
    回傳會員最近 N 天（預設 30 天）的紀錄，方便 history 頁面一次取得。
    回傳格式：
    [
      {
        "date": "2026-05-30",
        "weight": "65.2",
        "bmi": "22.4",
        "meals": {
          "早餐": [{"id": 1, "name": "...", "calories": "200"}, ...],
          "午餐": [...],
          "晚餐": [...]
        }
      }, ...
    ]
    """
    from datetime import timedelta
    from django.utils import timezone as dj_tz

    member_id = request.GET.get('member_id')
    if not member_id:
        return Response({
            "success": False,
            "message": "缺少 member_id"
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        days = int(request.GET.get('days') or 30)
    except ValueError:
        days = 30
    days = max(1, min(days, 365))

    today = dj_tz.localdate()
    start_date = today - timedelta(days=days - 1)

    logs = DailyLogs.objects.filter(
        member_id=member_id, date__gte=start_date, date__lte=today
    )
    log_by_date = {log.date.isoformat(): log for log in logs}

    diet_records = DietRecords.objects.filter(
        member_id=member_id, log_date__gte=start_date, log_date__lte=today
    ).order_by('id')

    meals_by_date = {}
    for r in diet_records:
        d = r.log_date.isoformat()
        bucket = meals_by_date.setdefault(d, {'早餐': [], '午餐': [], '晚餐': []})
        zh = _MEAL_EN_TO_ZH.get(r.meal_type)
        if not zh:
            continue
        bucket[zh].append({
            "id": str(r.id),
            "name": r.food_name or '',
            "calories": str(int(r.calories)) if r.calories is not None else '0',
        })

    result = []
    for i in range(days):
        d = today - timedelta(days=i)
        d_str = d.isoformat()
        log = log_by_date.get(d_str)
        result.append({
            "date": d_str,
            "weight": '' if not log or log.weight is None else str(log.weight),
            "bmi": '' if not log or log.bmi is None else str(log.bmi),
            "meals": meals_by_date.get(d_str, {'早餐': [], '午餐': [], '晚餐': []}),
        })

    return Response({
        "success": True,
        "days": days,
        "records": result,
    })
