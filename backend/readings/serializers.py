from rest_framework import serializers
from .models import PotholeReading


class PotholeReadingSerializer(serializers.ModelSerializer):
    # Support backward/legacy alias 'particle_depth' from payloads
    particle_depth = serializers.FloatField(required=False, write_only=True)

    class Meta:
        model = PotholeReading
        fields = ['id', 'latitude', 'longitude', 'pothole_depth', 'particle_depth', 'sensor_timestamp', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'pothole_depth': {'required': False}
        }

    def validate(self, attrs):
        # Handle depth field aliasing (particle_depth -> pothole_depth)
        if 'pothole_depth' not in attrs:
            if 'particle_depth' in attrs:
                attrs['pothole_depth'] = attrs.pop('particle_depth')
            else:
                raise serializers.ValidationError({"pothole_depth": "This field is required."})
        elif 'particle_depth' in attrs:
            attrs.pop('particle_depth')

        lat = attrs.get('latitude')
        lng = attrs.get('longitude')
        depth = attrs.get('pothole_depth')

        if lat is not None and not (-90.0 <= lat <= 90.0):
            raise serializers.ValidationError({"latitude": f"Latitude must be between -90 and 90. Got {lat}"})
        if lng is not None and not (-180.0 <= lng <= 180.0):
            raise serializers.ValidationError({"longitude": f"Longitude must be between -180 and 180. Got {lng}"})
        if depth is not None and depth < 0:
            raise serializers.ValidationError({"pothole_depth": f"Pothole depth must be non-negative. Got {depth}"})

        return attrs

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        # Expose particle_depth in representation so any legacy consumers also read it smoothly
        ret['particle_depth'] = ret['pothole_depth']
        return ret
