package com.yoga.dict.data.api

import com.yoga.dict.BuildConfig
import com.yoga.dict.data.model.Asana
import com.yoga.dict.data.model.AsanaName
import com.yoga.dict.data.model.AsanaPhoto
import com.yoga.dict.data.model.AsanaSource
import com.yoga.dict.data.model.Source
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.JsonDeserializationContext
import com.google.gson.JsonDeserializer
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParseException
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import kotlinx.coroutines.runBlocking
import java.lang.reflect.Type
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    
    @Provides
    @Singleton
    fun provideOkHttpClient(
        authPreferences: com.yoga.dict.data.local.AuthPreferences
    ): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
        
        val authInterceptor = okhttp3.Interceptor { chain ->
            val requestBuilder = chain.request().newBuilder()
            
            // Всегда получаем свежий токен из AuthPreferences
                    // Используем runBlocking только если мы не на главном потоке
            try {
                    if (android.os.Looper.getMainLooper().thread != Thread.currentThread()) {
                        val token = runBlocking { 
                            try {
                                authPreferences.getTokenSync()
                            } catch (e: Exception) {
                                null
                            }
                        }
                    if (token != null && token.isNotBlank()) {
                            requestBuilder.addHeader("Authorization", "Bearer $token")
                        }
                    }
                } catch (e: Exception) {
                    // Игнорируем ошибки получения токена
            }
            
            // Добавляем заголовок схемы БД для auth endpoints
            val path = chain.request().url.encodedPath
            if (path.startsWith("/api/auth") || path.startsWith("/api/users")) {
                requestBuilder.addHeader("X-DB-Schema", "dict_schema")
            }
            
            chain.proceed(requestBuilder.build())
        }
        
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }
    
    @Provides
    @Singleton
    fun provideGson(): Gson {
        return GsonBuilder()
            .setLenient()
            .registerTypeAdapter(Asana::class.java, AsanaDeserializer())
            .create()
    }
    
    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient,
        gson: Gson
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }
    
    @Provides
    @Singleton
    fun provideDictApiService(retrofit: Retrofit): DictApiService {
        return retrofit.create(DictApiService::class.java)
    }
    
    @Provides
    @Singleton
    fun provideAuthApiService(retrofit: Retrofit): AuthApiService {
        return retrofit.create(AuthApiService::class.java)
    }
}

// Кастомный десериализатор для Asana, так как API возвращает сложную структуру
class AsanaDeserializer : JsonDeserializer<Asana> {
    override fun deserialize(
        json: JsonElement?,
        typeOfT: Type?,
        context: JsonDeserializationContext?
    ): Asana {
        if (json == null || !json.isJsonObject) {
            throw JsonParseException("Invalid Asana JSON")
        }
        
        val jsonObject = json.asJsonObject
        
        val id = jsonObject.get("id")?.asString ?: ""
        
        // Парсим name
        val nameObj = jsonObject.getAsJsonObject("name")
        val name = AsanaName(
            id = nameObj.get("id")?.asString,
            name_ru = nameObj.get("ru")?.asString ?: nameObj.get("name_ru")?.asString ?: "",
            name_sanskrit = nameObj.get("sanskrit")?.asString ?: nameObj.get("name_sanskrit")?.asString,
            transliteration = nameObj.get("transliteration")?.asString ?: nameObj.get("nameInTranslit")?.asString,
            definition = nameObj.get("definition")?.asString ?: nameObj.get("nameDefinition")?.asString
        )
        
        // Парсим photos
        val photos = mutableListOf<AsanaPhoto>()
        val photosArray = jsonObject.getAsJsonArray("photos")
        photosArray?.forEach { photoElement ->
            if (photoElement.isJsonObject) {
                val photoObj = photoElement.asJsonObject
                val photoId = photoObj.get("id")?.asString ?: ""
                // API возвращает поле "image", а не "url" или "s3_path"
                var photoUrl = photoObj.get("image")?.asString 
                    ?: photoObj.get("url")?.asString 
                    ?: photoObj.get("s3_path")?.asString 
                    ?: ""
                val sourceId = photoObj.get("source")?.asString ?: photoObj.get("source_id")?.asString
                // Если URL относительный, добавляем базовый URL
                if (photoUrl.isNotEmpty() && !photoUrl.startsWith("http://") && !photoUrl.startsWith("https://")) {
                    photoUrl = "${BuildConfig.API_BASE_URL}${if (photoUrl.startsWith("/")) "" else "/"}$photoUrl"
                }
                if (photoUrl.isNotEmpty()) {
                    photos.add(AsanaPhoto(photoId, photoUrl, sourceId))
                }
            }
        }
        
        // Парсим sources
        val sources = mutableListOf<AsanaSource>()
        val sourcesArray = jsonObject.getAsJsonArray("sources")
        sourcesArray?.forEach { sourceElement ->
            if (sourceElement.isJsonObject) {
                val sourceObj = sourceElement.asJsonObject
                val sourceId = sourceObj.get("id")?.asString ?: ""
                val title = sourceObj.get("title")?.asString ?: ""
                val author = sourceObj.get("author")?.asString ?: ""
                val year = sourceObj.get("year")?.asInt
                val publisher = sourceObj.get("publisher")?.asString
                sources.add(AsanaSource(sourceId, title, author, year, publisher))
            }
        }
        
        return Asana(id, name, photos, sources)
    }
}

