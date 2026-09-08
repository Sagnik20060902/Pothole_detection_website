from django.urls import path
from .views import ReadingListCreateAPIView

urlpatterns = [
    path('readings/', ReadingListCreateAPIView.as_view(), name='reading-list-create'),
]
