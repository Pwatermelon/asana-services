package com.yoga.dict.data.repository

import com.yoga.dict.data.api.DictApiService
import com.yoga.dict.data.api.AsanaNameCreate
import com.yoga.dict.data.model.Source
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AsanaManagementRepository @Inject constructor(
    private val apiService: DictApiService
) {
    suspend fun getAsanaNames(): Result<List<com.yoga.dict.data.model.AsanaName>> {
        return try {
            val response = apiService.getAsanaNames()
            if (response.isSuccessful) {
                Result.success(response.body() ?: emptyList())
            } else {
                Result.failure(Exception("Failed to load names: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun addAsanaName(name: AsanaNameCreate): Result<String> {
        return try {
            val response = apiService.addAsanaName(name)
            if (response.isSuccessful) {
                Result.success(response.body()?.id ?: "")
            } else {
                Result.failure(Exception("Failed to add name: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun addAsana(
        selectedName: String?,
        newNameRu: String?,
        newNameSanskrit: String?,
        transliteration: String?,
        definition: String?,
        selectedSource: String?,
        newSourceTitle: String?,
        newSourceAuthor: String?,
        newSourceYear: String?,
        newSourcePublisher: String?,
        newSourcePages: String?,
        newSourceAnnotation: String?,
        photos: List<File>
    ): Result<Unit> {
        return try {
            val selectedNameBody = (selectedName ?: "").toRequestBody(MultipartBody.FORM)
            val newNameRuBody = newNameRu?.toRequestBody(MultipartBody.FORM)
            val newNameSanskritBody = newNameSanskrit?.toRequestBody(MultipartBody.FORM)
            val transliterationBody = transliteration?.toRequestBody(MultipartBody.FORM)
            val definitionBody = definition?.toRequestBody(MultipartBody.FORM)
            val selectedSourceBody = (selectedSource ?: "").toRequestBody(MultipartBody.FORM)
            val newSourceTitleBody = newSourceTitle?.toRequestBody(MultipartBody.FORM)
            val newSourceAuthorBody = newSourceAuthor?.toRequestBody(MultipartBody.FORM)
            val newSourceYearBody = newSourceYear?.toRequestBody(MultipartBody.FORM)
            val newSourcePublisherBody = newSourcePublisher?.toRequestBody(MultipartBody.FORM)
            val newSourcePagesBody = newSourcePages?.toRequestBody(MultipartBody.FORM)
            val newSourceAnnotationBody = newSourceAnnotation?.toRequestBody(MultipartBody.FORM)
            
            val photoParts = photos.map { file ->
                val requestFile = file.asRequestBody("image/*".toMediaTypeOrNull())
                MultipartBody.Part.createFormData("photos", file.name, requestFile)
            }
            
            val response = apiService.addAsana(
                selectedName = selectedNameBody,
                newNameRu = newNameRuBody,
                newNameSanskrit = newNameSanskritBody,
                transliteration = transliterationBody,
                definition = definitionBody,
                selectedSource = selectedSourceBody,
                newSourceTitle = newSourceTitleBody,
                newSourceAuthor = newSourceAuthorBody,
                newSourceYear = newSourceYearBody,
                newSourcePublisher = newSourcePublisherBody,
                newSourcePages = newSourcePagesBody,
                newSourceAnnotation = newSourceAnnotationBody,
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
    
    suspend fun addSource(
        title: String,
        author: String,
        year: String?,
        publisher: String?,
        pages: String?,
        annotation: String?
    ): Result<String> {
        return try {
            val titleBody = title.toRequestBody(MultipartBody.FORM)
            val authorBody = author.toRequestBody(MultipartBody.FORM)
            val yearBody = year?.toRequestBody(MultipartBody.FORM)
            val publisherBody = publisher?.toRequestBody(MultipartBody.FORM)
            val pagesBody = pages?.toRequestBody(MultipartBody.FORM)
            val annotationBody = annotation?.toRequestBody(MultipartBody.FORM)
            
            val response = apiService.addSource(
                title = titleBody,
                author = authorBody,
                year = yearBody,
                publisher = publisherBody,
                pages = pagesBody,
                annotation = annotationBody
            )
            
            if (response.isSuccessful) {
                Result.success(response.body()?.id ?: "")
            } else {
                Result.failure(Exception("Failed to add source: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteAsana(uri: String): Result<Unit> {
        return try {
            val response = apiService.deleteAsana(uri)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to delete: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun deleteSource(uri: String): Result<Unit> {
        return try {
            val response = apiService.deleteSource(uri)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to delete: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}







