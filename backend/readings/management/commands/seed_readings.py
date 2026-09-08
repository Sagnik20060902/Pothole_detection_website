from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random
from readings.models import PotholeReading


class Command(BaseCommand):
    help = 'Seeds realistic geotagged pothole field scan data into the database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=45,
            help='Number of pothole reading points to generate'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing readings before seeding'
        )

    def handle(self, *args, **options):
        count = options['count']
        if options['clear']:
            deleted, _ = PotholeReading.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Cleared {deleted} existing pothole readings.'))

        # Base starting location (San Francisco / Bay Area road inspection route)
        start_lat = 37.7749
        start_lng = -122.4194
        start_time = timezone.now() - timedelta(hours=2)

        readings = []
        curr_lat = start_lat
        curr_lng = start_lng
        curr_time = start_time

        for i in range(count):
            # Simulate driving trajectory
            curr_lat += random.uniform(0.0002, 0.0008)
            curr_lng += random.uniform(-0.0003, 0.0006)
            curr_time += timedelta(seconds=random.randint(15, 60))

            # Simulate pothole depth measurement (depth in cm, e.g. 1.5 cm to 24.8 cm, with occasional severe deep potholes)
            if random.random() < 0.15:
                # Severe deep pothole
                depth = round(random.uniform(14.0, 26.5), 1)
            elif random.random() < 0.40:
                # Moderate pothole
                depth = round(random.uniform(7.0, 13.9), 1)
            else:
                # Minor surface defect / small pothole
                depth = round(random.uniform(1.2, 6.9), 1)

            readings.append(PotholeReading(
                latitude=round(curr_lat, 6),
                longitude=round(curr_lng, 6),
                pothole_depth=depth,
                sensor_timestamp=curr_time
            ))

        PotholeReading.objects.bulk_create(readings)
        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {count} pothole readings into database!'))
