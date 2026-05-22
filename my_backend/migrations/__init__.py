import pymysql;

# 欺騙 Django 讓它以為 MariaDB 版本很高
pymysql.version_info = (10, 6, 0, 'final', 0)

pymysql.install_as_MySQLdb()