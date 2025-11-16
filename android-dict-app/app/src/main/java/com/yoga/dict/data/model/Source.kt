package com.yoga.dict.data.model

import android.os.Parcelable
import kotlinx.parcelize.Parcelize

@Parcelize
data class Source(
    val id: String,
    val title: String,
    val author: String,
    val year: Int? = null,
    val publisher: String? = null,
    val pages: Int? = null,
    val annotation: String? = null
) : Parcelable {
    val displayName: String
        get() = "$author - $title${year?.let { " ($it)" } ?: ""}"
}

