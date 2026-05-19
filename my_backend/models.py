from django.db import models

# 1. 成就表
class Achievements(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'achievements'

# 2. 會員表 (這是核心！)
class Members(models.Model):
    id = models.AutoField(primary_key=True)
    username = models.CharField(unique=True, max_length=255, blank=True, null=True)
    password = models.CharField(max_length=255, blank=True, null=True)
    role = models.CharField(max_length=5, blank=True, null=True)
    gender = models.CharField(max_length=6, blank=True, null=True)
    birthday = models.DateField(blank=True, null=True)
    height = models.FloatField(blank=True, null=True)
    initial_weight = models.FloatField(blank=True, null=True)
    activity_level = models.FloatField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)  # 自動記錄建立時間

    class Meta:
        db_table = 'members'

# 3. 每日紀錄表
class DailyLogs(models.Model):
    id = models.AutoField(primary_key=True)
    member = models.ForeignKey('Members', models.CASCADE, blank=True, null=True) # 改成 CASCADE 比較安全
    date = models.DateField(blank=True, null=True)
    weight = models.FloatField(blank=True, null=True)
    bmi = models.FloatField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'daily_logs'

# 4. 食物商品表
class Products(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    calories = models.FloatField(blank=True, null=True)
    creator = models.ForeignKey(Members, models.SET_NULL, blank=True, null=True)
    status = models.CharField(max_length=8, blank=True, null=True)

    class Meta:
        db_table = 'products'

# 5. 飲食紀錄表
class DietRecords(models.Model):
    id = models.AutoField(primary_key=True)
    member = models.ForeignKey('Members', models.CASCADE, blank=True, null=True)
    product = models.ForeignKey('Products', models.CASCADE, blank=True, null=True)
    meal_type = models.CharField(max_length=9, blank=True, null=True)
    serving_size = models.FloatField(blank=True, null=True)
    log_date = models.DateField(blank=True, null=True)

    class Meta:
        db_table = 'diet_records'

# 6. 會員成就關聯表
class MemberAchievements(models.Model):
    id = models.AutoField(primary_key=True)
    member = models.ForeignKey('Members', models.CASCADE, blank=True, null=True)
    achievement = models.ForeignKey(Achievements, models.CASCADE, blank=True, null=True)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'member_achievements'