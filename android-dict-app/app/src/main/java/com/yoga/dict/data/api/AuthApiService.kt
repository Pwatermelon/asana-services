package com.yoga.dict.data.api

import retrofit2.Response
import retrofit2.http.*

interface AuthApiService {
    
    @POST("api/auth")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<AuthResponse>
    
    @POST("api/auth/registration")
    suspend fun register(
        @Body request: RegisterRequest
    ): Response<AuthResponse>
    
    @GET("api/auth/check")
    suspend fun checkAuth(): Response<AuthCheckResponse>
    
    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>
    
    @GET("api/auth/reset_password_request")
    suspend fun resetPasswordRequest(
        @Query("login") login: String
    ): Response<Unit>
    
    @PATCH("api/auth/reset_password")
    suspend fun resetPasswordConfirm(
        @Body request: ResetPasswordRequest
    ): Response<Unit>
    
    @GET("api/auth/verify/{token}")
    suspend fun confirmRegistration(
        @Path("token") token: String
    ): Response<Unit>
    
    @GET("api/users/me")
    suspend fun getUserInfo(): Response<UserInfo>
}

data class LoginRequest(
    val login: String,
    val password: String
)

data class RegisterRequest(
    val login: String,
    val mail: String,
    val password: String
)

data class ResetPasswordRequest(
    val token: String,
    val password: String
)

data class AuthResponse(
    val access_token: String? = null,
    val token_type: String? = null,
    val message: String? = null
)

data class AuthCheckResponse(
    val is_authenticated: Boolean,
    val role: String?
)

data class UserInfo(
    val login: String,
    val mail: String? = null,
    val is_admin: Boolean = false,
    val permission_study: Boolean = false
)

