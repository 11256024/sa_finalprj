from rest_framework import serializers
from .models import Members, Products, DietRecords, DailyLogs, Achievements, MemberAchievements


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Members
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    # 額外回傳商品建立者資訊，讓前端可以判斷來源是「管理者」還是「使用者」
    creator_id = serializers.IntegerField(source='creator.id', read_only=True)
    creator_username = serializers.CharField(source='creator.username', read_only=True)
    creator_role = serializers.CharField(source='creator.role', read_only=True)

    class Meta:
        model = Products
        fields = [
            'id',
            'name',
            'unit',
            'calories',
            'status',
            'created_at',
            'creator',

            # 給前端顯示用
            'creator_id',
            'creator_username',
            'creator_role',
        ]


class DietRecordSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_calories = serializers.FloatField(source='product.calories', read_only=True)

    class Meta:
        model = DietRecords
        fields = '__all__'


class DailyLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyLogs
        fields = '__all__'


class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievements
        fields = '__all__'


class MemberAchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberAchievements
        fields = '__all__'
