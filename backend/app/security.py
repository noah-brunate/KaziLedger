ROLE_PERMISSIONS: dict[str, list[str]] = {
    "client": ["requests:create", "requests:read", "payments:create", "disputes:create"],
    "expert": [
        "requests:read",
        "requests:respond",
        "quotes:create",
        "wallet:read",
        "wallet:withdraw",
    ],
    "admin": [
        "admin:read",
        "admin:write",
        "services:manage",
        "applications:review",
        "disputes:resolve",
        "wallet:review",
    ],
}
