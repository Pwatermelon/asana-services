package com.yoga.dict.data.api

import com.yoga.dict.data.model.Asana
import com.yoga.dict.data.model.Source
import retrofit2.Response
import retrofit2.http.*

interface DictApiService {
    
    @GET("api/asanas")
    suspend fun getAsanas(): Response<List<Asana>>
    
    @GET("api/asana/{asana_id}")
    suspend fun getAsanaById(
        @Path("asana_id") asanaId: String
    ): Response<Asana>
    
    @GET("api/asanas/by-letter/{letter}")
    suspend fun getAsanasByLetter(
        @Path("letter") letter: String
    ): Response<List<Asana>>
    
    @GET("api/asanas/by-source/{source_id}")
    suspend fun getAsanasBySource(
        @Path("source_id") sourceId: String
    ): Response<List<Asana>>
    
    @GET("api/asanas/search")
    suspend fun searchAsanas(
        @Query("query") query: String,
        @Query("fuzzy") fuzzy: Boolean = true
    ): Response<List<Asana>>
    
    @GET("api/sources")
    suspend fun getSources(): Response<List<Source>>
    
    @GET("api/asana-names")
    suspend fun getAsanaNames(): Response<List<com.yoga.dict.data.model.AsanaName>>
    
    @GET("api/asana/{asana_id}/photo-by-source/{source_id}")
    suspend fun getPhotoOfAsanaFromSource(
        @Path("asana_id") asanaId: String,
        @Path("source_id") sourceId: String
    ): Response<com.yoga.dict.data.model.AsanaPhoto>
    
    // Методы для работы с isSameAsObject (аналогичные асаны)
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
}

data class SameAsRequest(
    val target_asana_id: String
)

data class MessageResponse(
    val message: String
)

