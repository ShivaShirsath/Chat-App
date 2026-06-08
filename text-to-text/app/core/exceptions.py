from fastapi import HTTPException, status

class GatewayException(HTTPException):
    def __init__(
        self,
        detail: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    ):
        super().__init__(status_code=status_code, detail=detail)

class ModelServiceException(GatewayException):
    def __init__(self, detail: str):
        super().__init__(
            detail=f"Model service failure: {detail}",
            status_code=status.HTTP_502_BAD_GATEWAY
        )

class ModelNotFoundException(GatewayException):
    def __init__(self, model_name: str):
        super().__init__(
            detail=f"Requested model or route '{model_name}' was not found or is unsupported.",
            status_code=status.HTTP_404_NOT_FOUND
        )

class InvalidRequestException(GatewayException):
    def __init__(self, detail: str):
        super().__init__(
            detail=detail,
            status_code=status.HTTP_400_BAD_REQUEST
        )
