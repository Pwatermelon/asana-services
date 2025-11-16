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
}

