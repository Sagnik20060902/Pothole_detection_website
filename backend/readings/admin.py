from django.contrib import admin
from .models import PotholeReading


@admin.register(PotholeReading)
class PotholeReadingAdmin(admin.ModelAdmin):
    list_display = ('id', 'latitude', 'longitude', 'pothole_depth', 'sensor_timestamp', 'created_at')
    list_filter = ('sensor_timestamp', 'created_at')
    search_fields = ('id', 'latitude', 'longitude')
    ordering = ('-sensor_timestamp',)
