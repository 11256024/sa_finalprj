from rest_framework import serializers
from .models import Members

class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Members
        fields = '__all__' # 代表我們要處理 Members 表裡的所有欄位