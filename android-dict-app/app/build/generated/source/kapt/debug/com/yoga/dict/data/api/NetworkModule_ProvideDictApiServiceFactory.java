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
public final class NetworkModule_ProvideDictApiServiceFactory implements Factory<DictApiService> {
  private final Provider<Retrofit> retrofitProvider;

  public NetworkModule_ProvideDictApiServiceFactory(Provider<Retrofit> retrofitProvider) {
    this.retrofitProvider = retrofitProvider;
  }

  @Override
  public DictApiService get() {
    return provideDictApiService(retrofitProvider.get());
  }

  public static NetworkModule_ProvideDictApiServiceFactory create(
      Provider<Retrofit> retrofitProvider) {
    return new NetworkModule_ProvideDictApiServiceFactory(retrofitProvider);
  }

  public static DictApiService provideDictApiService(Retrofit retrofit) {
    return Preconditions.checkNotNullFromProvides(NetworkModule.INSTANCE.provideDictApiService(retrofit));
  }
}
