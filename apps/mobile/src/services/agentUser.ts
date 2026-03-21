export const FINLY_DEFAULT_USER_ID = "user_mvp_1"

export const resolveScopedFinlyUserId = (scopeKey: string) => `${FINLY_DEFAULT_USER_ID}:${scopeKey}`
