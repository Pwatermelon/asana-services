package com.yoga.dict.data.repository

import com.yoga.dict.data.api.DictApiService
import com.yoga.dict.data.api.TextContentRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ContentRepository @Inject constructor(
    private val apiService: DictApiService
) {
    suspend fun getAboutProject(): Result<String> {
        return try {
            val response = apiService.getAboutProject()
            if (response.isSuccessful) {
                Result.success(response.body()?.content ?: "")
            } else {
                Result.failure(Exception("Failed to load about project: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateAboutProject(content: String): Result<Unit> {
        return try {
            val response = apiService.updateAboutProject(TextContentRequest(content))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to update: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getExpertInstructions(): Result<String> {
        return try {
            val response = apiService.getExpertInstructions()
            if (response.isSuccessful) {
                Result.success(response.body()?.content ?: "")
            } else {
                Result.failure(Exception("Failed to load instructions: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun updateExpertInstructions(content: String): Result<Unit> {
        return try {
            val response = apiService.updateExpertInstructions(TextContentRequest(content))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to update: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

