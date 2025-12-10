package com.yoga.dict.data.repository

import com.yoga.dict.data.api.DictApiService
import com.yoga.dict.data.api.ModerationItem
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ModerationRepository @Inject constructor(
    private val apiService: DictApiService
) {
    suspend fun getModerationItems(resolved: Boolean? = null): Result<List<ModerationItem>> {
        return try {
            val response = apiService.getModerationItems(resolved)
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load moderation items: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getModerationItemsCount(): Result<Int> {
        return try {
            val response = apiService.getModerationItemsCount()
            if (response.isSuccessful) {
                Result.success(response.body()?.count ?: 0)
            } else {
                Result.failure(Exception("Failed to load count: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun exportModerationItems(): Result<okhttp3.ResponseBody> {
        return try {
            val response = apiService.exportModerationItems(null)
            if (response.isSuccessful) {
                Result.success(response.body() ?: throw Exception("Empty response"))
            } else {
                Result.failure(Exception("Failed to export: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun addAsanaFromModeration(
        itemId: Int,
        nameId: String,
        sourceId: String,
        photos: List<File>?
    ): Result<Unit> {
        return try {
            val nameIdBody = nameId.toRequestBody(MultipartBody.FORM)
            val sourceIdBody = sourceId.toRequestBody(MultipartBody.FORM)
            
            val photoParts = photos?.map { file ->
                val requestFile = file.asRequestBody("image/*".toMediaTypeOrNull())
                MultipartBody.Part.createFormData("photos", file.name, requestFile)
            } ?: emptyList()
            
            val response = apiService.addAsanaFromModeration(
                itemId = itemId,
                nameId = nameIdBody,
                sourceId = sourceIdBody,
                photos = photoParts
            )
            
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to add asana: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun resolveModerationItem(itemId: Int): Result<Unit> {
        return try {
            val response = apiService.resolveModerationItem(itemId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to resolve item: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

