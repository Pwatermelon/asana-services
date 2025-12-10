package com.yoga.dict.data.api

import com.yoga.dict.data.model.Asana
import com.yoga.dict.data.model.Source
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

interface DictApiService {
    
    // ========== АСАНЫ ==========
    @GET("api/asanas")
    suspend fun getAsanas(): Response<List<Asana>>
    
    @GET("api/asana/{asana_id}")
    suspend fun getAsanaById(
        @Path("asana_id", encoded = true) asanaId: String
    ): Response<Asana>
    
    @GET("api/asanas/by-letter/{letter}")
    suspend fun getAsanasByLetter(
        @Path("letter") letter: String
    ): Response<List<Asana>>
    
    @GET("api/asanas/by-source/{source_id}")
    suspend fun getAsanasBySource(
        @Path("source_id", encoded = true) sourceId: String
    ): Response<List<Asana>>
    
    @GET("api/asanas/search")
    suspend fun searchAsanas(
        @Query("query") query: String,
        @Query("fuzzy") fuzzy: Boolean = true
    ): Response<List<Asana>>
    
    @POST("api/asana")
    @Multipart
    suspend fun addAsana(
        @Part("selected_name") selectedName: RequestBody,
        @Part("new_name_ru") newNameRu: RequestBody?,
        @Part("new_name_sanskrit") newNameSanskrit: RequestBody?,
        @Part("transliteration") transliteration: RequestBody?,
        @Part("definition") definition: RequestBody?,
        @Part("selected_source") selectedSource: RequestBody,
        @Part("new_source_title") newSourceTitle: RequestBody?,
        @Part("new_source_author") newSourceAuthor: RequestBody?,
        @Part("new_source_year") newSourceYear: RequestBody?,
        @Part("new_source_publisher") newSourcePublisher: RequestBody?,
        @Part("new_source_pages") newSourcePages: RequestBody?,
        @Part("new_source_annotation") newSourceAnnotation: RequestBody?,
        @Part photos: List<MultipartBody.Part>
    ): Response<MessageResponse>
    
    @DELETE("api/asanas")
    suspend fun deleteAsana(
        @Query("uri") uri: String
    ): Response<MessageResponse>
    
    @POST("api/asana/{asana_id}/add-photo")
    @Multipart
    suspend fun addPhotoToAsana(
        @Path("asana_id") asanaId: String,
        @Part("source_id") sourceId: RequestBody,
        @Part photos: List<MultipartBody.Part>
    ): Response<PhotoAddResponse>
    
    @GET("api/asana/{asana_id}/photo-by-source/{source_id}")
    suspend fun getPhotoOfAsanaFromSource(
        @Path("asana_id") asanaId: String,
        @Path("source_id") sourceId: String
    ): Response<com.yoga.dict.data.model.AsanaPhoto>
    
    @GET("api/asana/{asana_id}/similar")
    suspend fun getSimilarAsanas(
        @Path("asana_id") asanaId: String
    ): Response<List<Asana>>
    
    @POST("api/asana/{asana_id}/same-as")
    suspend fun setSameAsObject(
        @Path("asana_id") asanaId: String,
        @Body request: SameAsRequest
    ): Response<MessageResponse>
    
    @DELETE("api/asana/{asana_id}/same-as/{target_asana_id}")
    suspend fun removeSameAsObject(
        @Path("asana_id") asanaId: String,
        @Path("target_asana_id") targetAsanaId: String
    ): Response<MessageResponse>
    
    // ========== ИСТОЧНИКИ ==========
    @GET("api/sources")
    suspend fun getSources(): Response<List<Source>>
    
    @POST("api/sources")
    @Multipart
    suspend fun addSource(
        @Part("title") title: RequestBody,
        @Part("author") author: RequestBody,
        @Part("year") year: RequestBody?,
        @Part("publisher") publisher: RequestBody?,
        @Part("pages") pages: RequestBody?,
        @Part("annotation") annotation: RequestBody?
    ): Response<SourceResponse>
    
    @DELETE("api/delete-source")
    suspend fun deleteSource(
        @Query("uri") uri: String
    ): Response<MessageResponse>
    
    // ========== НАЗВАНИЯ АСАН ==========
    @GET("api/asana-names")
    suspend fun getAsanaNames(): Response<List<com.yoga.dict.data.model.AsanaName>>
    
    @POST("api/asana-names")
    suspend fun addAsanaName(
        @Body name: AsanaNameCreate
    ): Response<AsanaNameResponse>
    
    @DELETE("api/delete-asana-name")
    suspend fun deleteAsanaName(
        @Query("uri") uri: String
    ): Response<MessageResponse>
    
    // ========== МОДЕРАЦИЯ ==========
    @GET("api/moderation/items")
    suspend fun getModerationItems(
        @Query("resolved") resolved: Boolean? = null
    ): Response<List<ModerationItem>>
    
    @GET("api/moderation/items/count")
    suspend fun getModerationItemsCount(): Response<ModerationCountResponse>
    
    @GET("api/moderation/items/export")
    suspend fun exportModerationItems(
        @Query("resolved") resolved: Boolean? = null
    ): Response<ResponseBody>
    
    @POST("api/moderation/items/{item_id}/add-asana")
    @Multipart
    suspend fun addAsanaFromModeration(
        @Path("item_id") itemId: Int,
        @Part("name_id") nameId: RequestBody,
        @Part("source_id") sourceId: RequestBody,
        @Part photos: List<MultipartBody.Part>?
    ): Response<MessageResponse>
    
    @POST("api/moderation/items/{item_id}/resolve")
    suspend fun resolveModerationItem(
        @Path("item_id") itemId: Int
    ): Response<MessageResponse>
    
    // ========== КОНТЕНТ ==========
    @GET("api/about-project")
    suspend fun getAboutProject(): Response<TextContentResponse>
    
    @POST("api/about-project")
    suspend fun updateAboutProject(
        @Body content: TextContentRequest
    ): Response<MessageResponse>
    
    @GET("api/expert-instructions")
    suspend fun getExpertInstructions(): Response<TextContentResponse>
    
    @POST("api/expert-instructions")
    suspend fun updateExpertInstructions(
        @Body content: TextContentRequest
    ): Response<MessageResponse>
    
    // ========== ОНТОЛОГИЯ ==========
    @GET("api/download-ontology")
    suspend fun downloadOntology(): Response<ResponseBody>
    
    @POST("api/upload-ontology")
    @Multipart
    suspend fun uploadOntology(
        @Part ontologyFile: MultipartBody.Part
    ): Response<MessageResponse>
    
    // ========== ИМПОРТ/ЭКСПОРТ ==========
    @POST("api/import/asanas")
    @Multipart
    suspend fun importAsanas(
        @Part("source_id") sourceId: RequestBody,
        @Part excelFile: MultipartBody.Part
    ): Response<ImportTaskResponse>
    
    @GET("api/import/status/{task_id}")
    suspend fun getImportStatus(
        @Path("task_id") taskId: String
    ): Response<ImportStatusResponse>
}

// ========== МОДЕЛИ ДАННЫХ ==========
data class SameAsRequest(
    val target_asana_id: String
)

data class MessageResponse(
    val message: String
)

data class PhotoAddResponse(
    val message: String,
    val photo_ids: List<String>
)

data class SourceResponse(
    val message: String,
    val id: String
)

data class AsanaNameCreate(
    val name_ru: String,
    val name_sanskrit: String? = null,
    val transliteration: String? = null,
    val definition: String? = null
)

data class AsanaNameResponse(
    val message: String,
    val id: String
)

data class ModerationItem(
    val id: Int,
    val asana_name: String?,
    val source_id: String?,
    val error_message: String,
    val row_number: Int?,
    val import_data: Map<String, Any>?,
    val created_at: String,
    val resolved: Boolean,
    val resolved_by: String?,
    val resolved_at: String?,
    val moderation_type: String?,
    val object_type: String?,
    val suggested_name_ru: String?,
    val suggested_name_sanskrit: String?,
    val suggested_transliteration: String?,
    val suggested_definition: String?,
    val existing_name_id: String?,
    val existing_name_ru: String?
)

data class ModerationCountResponse(
    val count: Int
)

data class TextContentResponse(
    val content: String
)

data class TextContentRequest(
    val content: String
)

data class ImportTaskResponse(
    val task_id: String,
    val message: String
)

data class ImportStatusResponse(
    val status: String,
    val progress: Int,
    val message: String?,
    val errors: List<String>?
)

