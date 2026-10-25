from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db import transaction
from django.shortcuts import get_object_or_404
from .models import PotholeReading
from .serializers import PotholeReadingSerializer


class ReadingListCreateAPIView(APIView):
    """
    API view for retrieving all pothole readings and performing single or bulk batch ingestion.
    """

    def get(self, request):
        readings = PotholeReading.objects.all().order_by('sensor_timestamp')
        serializer = PotholeReadingSerializer(readings, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        is_many = isinstance(request.data, list)
        serializer = PotholeReadingSerializer(data=request.data, many=is_many)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                if is_many:
                    # Save using Model.objects.bulk_create for high performance inside atomic transaction
                    validated_data_list = serializer.validated_data
                    instances = [PotholeReading(**item) for item in validated_data_list]
                    created_instances = PotholeReading.objects.bulk_create(instances)
                    output_serializer = PotholeReadingSerializer(created_instances, many=True)
                    return Response(output_serializer.data, status=status.HTTP_201_CREATED)
                else:
                    instance = serializer.save()
                    return Response(PotholeReadingSerializer(instance).data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {"detail": f"An error occurred during batch ingestion: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request):
        count = PotholeReading.objects.all().delete()[0]
        return Response({"detail": f"Successfully deleted {count} readings."}, status=status.HTTP_200_OK)


class ReadingDetailAPIView(APIView):
    """
    API view for retrieving or deleting a specific pothole reading (e.g. after it has been treated/repaired).
    """

    def get(self, request, pk):
        reading = get_object_or_404(PotholeReading, pk=pk)
        return Response(PotholeReadingSerializer(reading).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        reading = get_object_or_404(PotholeReading, pk=pk)
        reading_id = reading.id
        reading.delete()
        return Response(
            {"detail": f"Pothole #{reading_id} successfully marked as treated and deleted.", "id": reading_id},
            status=status.HTTP_200_OK
        )
