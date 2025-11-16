package com.yoga.dict.data.api;

import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.Preconditions;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;
import retrofit2.Retrofit;

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
public final class NetworkModule_ProvideAuthApiServiceFactory implements Factory<AuthApiService> {
  private final Provider<Retrofit> retrofitProvider;

  public NetworkModule_ProvideAuthApiServiceFactory(Provider<Retrofit> retrofitProvider) {
    this.retrofitProvider = retrofitProvider;
  }

  @Override
  public AuthApiService get() {
    return provideAuthApiService(retrofitProvider.get());
  }

  public static NetworkModule_ProvideAuthApiServiceFactory create(
      Provider<Retrofit> retrofitProvider) {
    return new NetworkModule_ProvideAuthApiServiceFactory(retrofitProvider);
  }

  public static AuthApiService provideAuthApiService(Retrofit retrofit) {
    return Preconditions.checkNotNullFromProvides(NetworkModule.INSTANCE.provideAuthApiService(retrofit));
  }
}
