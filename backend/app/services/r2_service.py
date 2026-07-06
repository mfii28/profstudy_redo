import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from app.core.config import settings
from typing import Optional

class R2Service:
    def __init__(self):
        # Only initialize if credentials are provided
        if all([settings.R2_ACCOUNT_ID, settings.R2_ACCESS_KEY_ID, settings.R2_SECRET_ACCESS_KEY]):
            endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
            self.client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                config=Config(signature_version="s3v4"),
                region_name="auto"
            )
            self.bucket_name = settings.R2_BUCKET_NAME
        else:
            self.client = None
            self.bucket_name = None

    def generate_upload_url(self, object_key: str, expiration: int = 3600) -> Optional[str]:
        """Generate a presigned URL to upload a file directly to Cloudflare R2"""
        if not self.client or not self.bucket_name:
            return None
        try:
            url = self.client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": object_key,
                },
                ExpiresIn=expiration,
            )
            return url
        except ClientError as e:
            # Handle client-specific errors or logging
            print(f"Error generating upload URL: {e}")
            return None

    def generate_download_url(self, object_key: str, expiration: int = 3600) -> Optional[str]:
        """Generate a presigned URL to view/download a file from Cloudflare R2"""
        if not self.client or not self.bucket_name:
            return None
        try:
            url = self.client.generate_presigned_url(
                ClientMethod="get_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": object_key,
                },
                ExpiresIn=expiration,
            )
            return url
        except ClientError as e:
            print(f"Error generating download URL: {e}")
            return None

    def delete_object(self, object_key: str) -> bool:
        """Delete an object from Cloudflare R2"""
        if not self.client or not self.bucket_name:
            return False
        try:
            self.client.delete_object(
                Bucket=self.bucket_name,
                Key=object_key
            )
            return True
        except ClientError as e:
            print(f"Error deleting object: {e}")
            return False

    def initiate_multipart_upload(self, object_key: str, content_type: str) -> Optional[str]:
        if not self.client or not self.bucket_name:
            return None
        try:
            response = self.client.create_multipart_upload(
                Bucket=self.bucket_name,
                Key=object_key,
                ContentType=content_type
            )
            return response.get('UploadId')
        except ClientError as e:
            print(f"Error initiating multipart upload: {e}")
            return None

    def generate_presigned_part_url(self, object_key: str, upload_id: str, part_number: int, expiration: int = 3600) -> Optional[str]:
        if not self.client or not self.bucket_name:
            return None
        try:
            url = self.client.generate_presigned_url(
                ClientMethod='upload_part',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': object_key,
                    'UploadId': upload_id,
                    'PartNumber': part_number
                },
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            print(f"Error generating presigned part URL: {e}")
            return None

    def complete_multipart_upload(self, object_key: str, upload_id: str, parts: list) -> bool:
        if not self.client or not self.bucket_name:
            return False
        try:
            # parts is a list of dicts: [{'PartNumber': 1, 'ETag': '"..."'}, ...]
            self.client.complete_multipart_upload(
                Bucket=self.bucket_name,
                Key=object_key,
                UploadId=upload_id,
                MultipartUpload={'Parts': parts}
            )
            return True
        except ClientError as e:
            print(f"Error completing multipart upload: {e}")
            return False

    def abort_multipart_upload(self, object_key: str, upload_id: str) -> bool:
        if not self.client or not self.bucket_name:
            return False
        try:
            self.client.abort_multipart_upload(
                Bucket=self.bucket_name,
                Key=object_key,
                UploadId=upload_id
            )
            return True
        except ClientError as e:
            print(f"Error aborting multipart upload: {e}")
            return False

# Instantiate a single global service instance
r2_service = R2Service()
