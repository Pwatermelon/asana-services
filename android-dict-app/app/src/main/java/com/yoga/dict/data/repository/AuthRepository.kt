package com.yoga.dict.data.repository

import com.yoga.dict.data.api.AuthApiService
import com.yoga.dict.data.api.AuthCheckResponse
import com.yoga.dict.data.api.UserInfo
import com.yoga.dict.data.api.LoginRequest
import com.yoga.dict.data.api.RegisterRequest
import com.yoga.dict.data.api.ResetPasswordRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApiService
) {
    suspend fun login(username: String, password: String, rememberMe: Boolean = false): Result<String> {
        return try {
            val response = authApi.login(LoginRequest(username, password))
            if (response.isSuccessful) {
                val token = response.body()?.access_token
                if (token != null) {
                    Result.success(token)
                } else {
                    Result.failure(Exception("Token not received"))
                }
            } else {
                Result.failure(Exception("Login failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun register(login: String, mail: String, password: String): Result<Unit> {
        return try {
            val response = authApi.register(RegisterRequest(login, mail, password))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Registration failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun confirmRegistration(token: String): Result<Unit> {
        return try {
            val response = authApi.confirmRegistration(token)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Confirmation failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun checkAuth(): Result<AuthCheckResponse> {
        return try {
            // Используем /api/users/me для проверки аутентификации
            val response = authApi.getUserInfo()
            if (response.isSuccessful) {
                val userInfo = response.body()
                if (userInfo != null) {
                    // Определяем роль пользователя
                    // Обычный пользователь (не админ и не эксперт) = неавторизованный
                    val role = when {
                        userInfo.is_admin -> "admin"
                        userInfo.permission_study -> "expert"
                        else -> null // Обычный пользователь = неавторизованный
                    }
                    if (role != null) {
                        Result.success(AuthCheckResponse(true, role))
                    } else {
                        // Обычный пользователь = неавторизованный
                        Result.success(AuthCheckResponse(false, null))
                    }
                } else {
                    Result.success(AuthCheckResponse(false, null))
                }
            } else {
                // Если 401 или 403 - пользователь не аутентифицирован
                if (response.code() == 401 || response.code() == 403) {
                    Result.success(AuthCheckResponse(false, null))
                } else {
                    Result.failure(Exception("Auth check failed: ${response.code()}"))
                }
            }
        } catch (e: Exception) {
            // При любой ошибке считаем, что пользователь не аутентифицирован
            Result.success(AuthCheckResponse(false, null))
        }
    }
    
    suspend fun getUserInfo(): Result<UserInfo> {
        return try {
            val response = authApi.getUserInfo()
            if (response.isSuccessful) {
                Result.success(response.body() ?: throw Exception("User info not available"))
            } else {
                Result.failure(Exception("Failed to get user info: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun logout(): Result<Unit> {
        return try {
            val response = authApi.logout()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun resetPasswordRequest(login: String): Result<Unit> {
        return try {
            val response = authApi.resetPasswordRequest(login)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Reset password request failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun resetPasswordConfirm(token: String, password: String): Result<Unit> {
        return try {
            val response = authApi.resetPasswordConfirm(ResetPasswordRequest(token, password))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Reset password confirm failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

