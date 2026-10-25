from django.db import models


class PotholeReading(models.Model):
    SOURCE_CHOICES = [
        ('manual', 'Manual Upload'),
        ('wifi', 'WiFi Live Telemetry'),
        ('usb_serial', 'USB Cable (Serial)'),
    ]

    latitude = models.FloatField(help_text="Latitude coordinate (-90 to 90)")
    longitude = models.FloatField(help_text="Longitude coordinate (-180 to 180)")
    pothole_depth = models.FloatField(help_text="Pothole depth measurement (e.g. cm or mm, >= 0)")
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual', help_text="Data ingestion source")
    sensor_timestamp = models.DateTimeField(db_index=True, help_text="Timestamp recorded on-device in the field")
    created_at = models.DateTimeField(auto_now_add=True, help_text="Server record insertion timestamp")

    class Meta:
        ordering = ['sensor_timestamp']

    def __str__(self):
        return f"Pothole #{self.id} | Lat: {self.latitude}, Lng: {self.longitude} | Depth: {self.pothole_depth} | Source: {self.source} | {self.sensor_timestamp}"
