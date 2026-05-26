from django.db import models
from django.utils import timezone


# 1. 成就表
class Achievements(models.Model):
    id = models.AutoField(primary_key=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'achievements'

    def __str__(self):
        return self.title


# 2. 會員表
class Members(models.Model):
    ROLE_CHOICES = [
        ('user', '一般會員'),
        ('admin', '管理員'),
    ]

    id = models.AutoField(primary_key=True)
    username = models.CharField(unique=True, max_length=255)
    password = models.CharField(max_length=255)

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    gender = models.CharField(max_length=10, blank=True, null=True)
    birthday = models.DateField(blank=True, null=True)

    height = models.FloatField(blank=True, null=True)
    initial_weight = models.FloatField(blank=True, null=True)

    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'members'

    def __str__(self):
        return self.username


# 3. 每日體重 / BMI 紀錄表
class DailyLogs(models.Model):
    id = models.AutoField(primary_key=True)

    member = models.ForeignKey(
        Members,
        on_delete=models.CASCADE,
        related_name='daily_logs'
    )

    date = models.DateField(default=timezone.localdate)
    weight = models.FloatField(blank=True, null=True)
    bmi = models.FloatField(blank=True, null=True)

    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'daily_logs'
        ordering = ['-date']

    def save(self, *args, **kwargs):
        if self.weight and self.member and self.member.height:
            height_m = self.member.height / 100
            self.bmi = round(self.weight / (height_m * height_m), 2)

        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.member.username} - {self.date}'


# 4. 食品資料表
class Products(models.Model):
    STATUS_CHOICES = [
        ('approved', '已核准'),
        ('pending', '待審核'),
        ('rejected', '已拒絕'),
        ('user_created', '使用者新增'),
    ]

    id = models.AutoField(primary_key=True)

    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=50, default='份')
    calories = models.FloatField(default=0)

    creator = models.ForeignKey(
        Members,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='created_products'
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='approved'
    )

    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'products'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} / {self.unit}'


# 5. 飲食紀錄表
class DietRecords(models.Model):
    MEAL_CHOICES = [
        ('breakfast', '早餐'),
        ('lunch', '午餐'),
        ('dinner', '晚餐'),
    ]

    id = models.AutoField(primary_key=True)

    member = models.ForeignKey(
        Members,
        on_delete=models.CASCADE,
        related_name='diet_records'
    )

    product = models.ForeignKey(
        Products,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        related_name='diet_records'
    )

    meal_type = models.CharField(max_length=20, choices=MEAL_CHOICES)
    serving_size = models.FloatField(default=1)

    food_name = models.CharField(max_length=255, blank=True, null=True)
    unit = models.CharField(max_length=50, blank=True, null=True)
    calories = models.FloatField(default=0)
    total_calories = models.FloatField(default=0)

    log_date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'diet_records'
        ordering = ['-log_date', 'meal_type']

    def save(self, *args, **kwargs):
        if self.product:
            if not self.food_name:
                self.food_name = self.product.name
            if not self.unit:
                self.unit = self.product.unit
            if not self.calories:
                self.calories = self.product.calories

        self.total_calories = round((self.calories or 0) * (self.serving_size or 1), 2)

        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.member.username} - {self.log_date} - {self.food_name}'


# 6. 會員成就關聯表
class MemberAchievements(models.Model):
    id = models.AutoField(primary_key=True)

    member = models.ForeignKey(
        Members,
        on_delete=models.CASCADE,
        related_name='member_achievements'
    )

    achievement = models.ForeignKey(
        Achievements,
        on_delete=models.CASCADE,
        related_name='member_achievements'
    )

    earned_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'member_achievements'

    def __str__(self):
        return f'{self.member.username} - {self.achievement.title}'