from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta
from readings.models import PotholeReading


class PotholeReadingAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('reading-list-create')
        self.now = timezone.now()

    def test_single_post_ingestion(self):
        payload = {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "pothole_depth": 8.5,
            "sensor_timestamp": self.now.isoformat()
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PotholeReading.objects.count(), 1)
        reading = PotholeReading.objects.first()
        self.assertEqual(reading.pothole_depth, 8.5)

    def test_legacy_field_alias_post_ingestion(self):
        payload = {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "particle_depth": 12.3,
            "sensor_timestamp": self.now.isoformat()
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PotholeReading.objects.count(), 1)
        reading = PotholeReading.objects.first()
        self.assertEqual(reading.pothole_depth, 12.3)

    def test_bulk_array_post_ingestion(self):
        payload = [
            {
                "latitude": 37.7749,
                "longitude": -122.4194,
                "pothole_depth": 4.2,
                "sensor_timestamp": (self.now - timedelta(seconds=30)).isoformat()
            },
            {
                "latitude": 37.7755,
                "longitude": -122.4188,
                "pothole_depth": 15.6,
                "sensor_timestamp": self.now.isoformat()
            }
        ]
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PotholeReading.objects.count(), 2)

    def test_invalid_coordinates_validation(self):
        payload = {
            "latitude": 150.0,  # Invalid latitude (> 90)
            "longitude": -122.4194,
            "pothole_depth": 5.0,
            "sensor_timestamp": self.now.isoformat()
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("latitude", str(response.data))

    def test_negative_depth_validation(self):
        payload = {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "pothole_depth": -3.5,  # Invalid depth (< 0)
            "sensor_timestamp": self.now.isoformat()
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("pothole_depth", str(response.data))

    def test_get_readings_chronological_order(self):
        t1 = self.now - timedelta(hours=1)
        t2 = self.now - timedelta(minutes=30)
        t3 = self.now

        # Insert out of order
        PotholeReading.objects.create(latitude=37.1, longitude=-122.1, pothole_depth=5.0, sensor_timestamp=t2)
        PotholeReading.objects.create(latitude=37.2, longitude=-122.2, pothole_depth=8.0, sensor_timestamp=t3)
        PotholeReading.objects.create(latitude=37.0, longitude=-122.0, pothole_depth=2.0, sensor_timestamp=t1)

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(len(data), 3)
        # Check ascending order
        self.assertEqual(data[0]['pothole_depth'], 2.0)
        self.assertEqual(data[1]['pothole_depth'], 5.0)
        self.assertEqual(data[2]['pothole_depth'], 8.0)
