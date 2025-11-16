package com.yoga.dict.data.api;

import com.yoga.dict.data.local.AuthPreferences;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;
import okhttp3.OkHttpClient;

@ScopeMetadata("javax.inject.Singleton")
@QualifierMetadata
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava"
})
public final class NetworkModule_ProvideOkHttpClientFactory implements Factory<OkHttpClient> {
  private final Provider<AuthPreferences> authPreferencesProvider;

  public NetworkModule_ProvideOkHttpClientFactory(
      Provider<AuthPreferences> authPreferencesProvider) {
    this.authPreferencesProvider = authPreferencesProvider;
  }

  @Override
  public OkHttpClient get() {
    return provideOkHttpClient(authPreferencesProvider.get());
  }

  public static NetworkModule_ProvideOkHttpClientFactory create(
      Provider<AuthPreferences> authPreferencesProvider) {
    return new NetworkModule_ProvideOkHttpClientFactory(authPreferencesProvider);
  }

  public static OkHttpClient provideOkHttpClient(AuthPreferences authPreferences) {
    return Preconditions.checkNotNullFromProvides(NetworkModule.INSTANCE.provideOkHttpClient(authPreferences));
  }
}
