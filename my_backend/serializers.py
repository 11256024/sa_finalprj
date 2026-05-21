from rest_framework import serializers
from .models import Members, Products, DietRecords, DailyLogs, Achievements, MemberAchievements


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Members
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Products
        fields = '__all__'


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