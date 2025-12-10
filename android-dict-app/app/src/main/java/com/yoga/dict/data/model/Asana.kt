package com.yoga.dict.data.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class Asana(
    val id: String,
    val name: AsanaName,
    val photos: List<AsanaPhoto>,
    val sources: List<AsanaSource>
) : Parcelable

@Parcelize
data class AsanaName(
    val id: String? = null,
    val name_ru: String,
    val name_sanskrit: String? = null,
    val transliteration: String? = null,
    val definition: String? = null
) : Parcelable {
    val displayName: String
        get() = name_ru
}

@Parcelize
data class AsanaPhoto(
    val id: String,
    val url: String,
    val sourceId: String? = null
) : Parcelable

@Parcelize
data class AsanaSource(
    val id: String,
    val title: String,
    val author: String,
    val year: Int? = null,
    val publisher: String? = null
) : Parcelable {
    val displayName: String
        get() = "$author - $title${year?.let { " ($it)" } ?: ""}"
}

