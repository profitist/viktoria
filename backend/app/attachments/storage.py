from __future__ import annotations

import asyncio

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.config import settings

# MinIO работает только в path-style. Без этого boto3 по умолчанию
# подписывает presigned-URL в virtual-hosted-style (bucket.host),
# который браузер не может разрезолвить — предпросмотр ломается.
_S3_CONFIG = Config(s3={"addressing_style": "path"}, signature_version="s3v4")


class StorageService:
    def __init__(
        self,
        endpoint: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        public_endpoint: str | None = None,
    ) -> None:
        self._bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="us-east-1",
            config=_S3_CONFIG,
        )
        # Отдельный клиент для presigned URL — подписывает с публичным хостом,
        # чтобы браузер мог открыть URL напрямую (Signature V4 включает host).
        url_endpoint = public_endpoint or endpoint
        self._url_client = (
            boto3.client(
                "s3",
                endpoint_url=url_endpoint,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name="us-east-1",
                config=_S3_CONFIG,
            )
            if url_endpoint != endpoint
            else self._client
        )

    def _ensure_bucket_sync(self) -> None:
        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError:
            self._client.create_bucket(Bucket=self._bucket)

    def _put_sync(self, key: str, data: bytes, content_type: str) -> None:
        self._client.put_object(
            Bucket=self._bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )

    def _signed_url_sync(self, key: str, ttl: int) -> str:
        return self._url_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=ttl,
        )

    def _delete_sync(self, key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=key)

    async def ensure_bucket(self) -> None:
        await asyncio.to_thread(self._ensure_bucket_sync)

    async def put(self, key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(self._put_sync, key, data, content_type)

    async def signed_url(self, key: str, ttl: int) -> str:
        return await asyncio.to_thread(self._signed_url_sync, key, ttl)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._delete_sync, key)


storage = StorageService(
    endpoint=settings.s3_endpoint,
    access_key=settings.s3_access_key,
    secret_key=settings.s3_secret_key,
    bucket=settings.s3_bucket,
    public_endpoint=settings.s3_public_endpoint,
)
