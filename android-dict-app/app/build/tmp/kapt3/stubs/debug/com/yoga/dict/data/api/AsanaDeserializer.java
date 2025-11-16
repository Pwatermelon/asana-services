package com.yoga.dict.data.api;

import com.yoga.dict.BuildConfig;
import com.yoga.dict.data.model.Asana;
import com.yoga.dict.data.model.AsanaName;
import com.yoga.dict.data.model.AsanaPhoto;
import com.yoga.dict.data.model.AsanaSource;
import com.yoga.dict.data.model.Source;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import dagger.Module;
import dagger.Provides;
import dagger.hilt.InstallIn;
import dagger.hilt.components.SingletonComponent;
import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;
import java.lang.reflect.Type;
import java.util.concurrent.TimeUnit;
import javax.inject.Singleton;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000\"\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\u0018\u00002\b\u0012\u0004\u0012\u00020\u00020\u0001B\u0005\u00a2\u0006\u0002\u0010\u0003J&\u0010\u0004\u001a\u00020\u00022\b\u0010\u0005\u001a\u0004\u0018\u00010\u00062\b\u0010\u0007\u001a\u0004\u0018\u00010\b2\b\u0010\t\u001a\u0004\u0018\u00010\nH\u0016\u00a8\u0006\u000b"}, d2 = {"Lcom/yoga/dict/data/api/AsanaDeserializer;", "Lcom/google/gson/JsonDeserializer;", "Lcom/yoga/dict/data/model/Asana;", "()V", "deserialize", "json", "Lcom/google/gson/JsonElement;", "typeOfT", "Ljava/lang/reflect/Type;", "context", "Lcom/google/gson/JsonDeserializationContext;", "app_debug"})
public final class AsanaDeserializer implements com.google.gson.JsonDeserializer<com.yoga.dict.data.model.Asana> {
    
    public AsanaDeserializer() {
        super();
    }
    
    @java.lang.Override()
    @org.jetbrains.annotations.NotNull()
    public com.yoga.dict.data.model.Asana deserialize(@org.jetbrains.annotations.Nullable()
    com.google.gson.JsonElement json, @org.jetbrains.annotations.Nullable()
    java.lang.reflect.Type typeOfT, @org.jetbrains.annotations.Nullable()
    com.google.gson.JsonDeserializationContext context) {
        return null;
    }
}