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
            // Веб-приложение использует только часть после # из полного ID
            // Например: http://.../Asana#asana_xxx -> asana_xxx
            // Затем кодирует через encodeURIComponent и передает в API
            val shortId = if (id.contains("#")) {
                id.split("#").last()
            } else {
                id
            }
            
            // Кодируем как в веб-приложении
            val encodedId = encodeURIComponent(shortId)
            val response = apiService.getAsanaById(encodedId)
            if (response.isSuccessful) {
                Result.success(response.body() ?: throw Exception("Asana not found"))
            } else {
                Result.failure(Exception("Failed to load asana: ${response.code()} ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    private fun encodeURIComponent(input: String): String {
        // Кодируем как encodeURIComponent в JavaScript
        // Используем URLEncoder.encode и заменяем + на %20, * на %2A, % на %25
        // Это даст нам правильное кодирование для path сегмента
        return try {
            java.net.URLEncoder.encode(input, "UTF-8")
                .replace("+", "%20")  // Пробелы как %20, а не +
                .replace("*", "%2A") // * должен быть закодирован
                .replace("%7E", "~") // ~ не кодируется
        } catch (e: Exception) {
            // Fallback: ручное кодирование
            val result = StringBuilder()
            for (char in input) {
                when {
                    char in 'A'..'Z' || char in 'a'..'z' || char in '0'..'9' -> {
                        result.append(char)
                    }
                    char == '-' || char == '_' || char == '.' || char == '!' || 
                    char == '~' || char == '*' || char == '\'' || char == '(' || char == ')' -> {
                        result.append(char)
                    }
                    else -> {
                        // Кодируем все остальные символы в UTF-8 как %XX (верхний регистр)
                        val bytes = char.toString().toByteArray(Charsets.UTF_8)
                        for (byte in bytes) {
                            result.append("%").append(String.format("%02X", byte.toInt() and 0xFF))
                        }
                    }
                }
            }
            result.toString()
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
    
    suspend fun getAsanasBySource(sourceId: String): Result<List<Asana>> {
        return try {
            // Веб-приложение использует только часть после # из полного ID
            // Затем кодирует через encodeURIComponent и передает в API
            val shortId = if (sourceId.contains("#")) {
                sourceId.split("#").last()
            } else {
                sourceId
            }
            
            // Кодируем как в веб-приложении
            val encodedId = encodeURIComponent(shortId)
            val response = apiService.getAsanasBySource(encodedId)
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load asanas by source: ${response.code()} ${response.message()}"))
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

