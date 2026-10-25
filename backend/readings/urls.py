from django.urls import path
from .views import ReadingListCreateAPIView, ReadingDetailAPIView

urlpatterns = [
    path('readings/', ReadingListCreateAPIView.as_view(), name='reading-list-create'),
    path('readings/<int:pk>/', ReadingDetailAPIView.as_view(), name='reading-detail'),
]
