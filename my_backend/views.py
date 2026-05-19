from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .models import Members
from .serializers import MemberSerializer

@api_view(['POST']) # 規定組員只能用 POST 方法傳資料過來
def register_member(request):
    serializer = MemberSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save() # 成功的話，這行會直接幫你存進 MySQL！
        return Response({"message": "註冊成功！"}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)