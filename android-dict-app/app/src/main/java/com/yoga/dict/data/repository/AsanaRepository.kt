package com.yoga.dict.data.repository

import com.yoga.dict.data.api.DictApiService
import com.yoga.dict.data.api.SameAsRequest
import com.yoga.dict.data.model.Asana
import com.yoga.dict.data.model.Source
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AsanaRepository @Inject constructor(
    private val apiService: DictApiService
) {
    suspend fun getAllAsanas(): Result<List<Asana>> {
        return try {
            val response = apiService.getAsanas()
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load asanas: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getAsanaById(id: String): Result<Asana> {
        return try {
            val response = apiService.getAsanaById(id)
            if (response.isSuccessful) {
                Result.success(response.body() ?: throw Exception("Asana not found"))
            } else {
                Result.failure(Exception("Failed to load asana: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getAsanasByLetter(letter: String): Result<List<Asana>> {
        return try {
            val response = apiService.getAsanasByLetter(letter)
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load asanas: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun searchAsanas(query: String, fuzzy: Boolean = true): Result<List<Asana>> {
        return try {
            val response = apiService.searchAsanas(query, fuzzy)
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Search failed: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getSources(): Result<List<Source>> {
        return try {
            val response = apiService.getSources()
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load sources: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // Методы для работы с isSameAsObject
    suspend fun getSimilarAsanas(asanaId: String): Result<List<Asana>> {
        return try {
            val response = apiService.getSimilarAsanas(asanaId)
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load similar asanas: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun setSameAsObject(asanaId: String, targetAsanaId: String): Result<Unit> {
        return try {
            val response = apiService.setSameAsObject(asanaId, SameAsRequest(targetAsanaId))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to set same as object: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun removeSameAsObject(asanaId: String, targetAsanaId: String): Result<Unit> {
        return try {
            val response = apiService.removeSameAsObject(asanaId, targetAsanaId)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to remove same as object: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

